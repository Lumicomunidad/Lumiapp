import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalAccessibleTranslation,
  computeBookProgressPercent,
  decomposePhraseToSigns,
  expandCommonAbbreviations,
  formatDuration,
  getPersonalGreeting,
  matchIdentityFromSpeech,
  matchModeFromSpeech,
  matchVoiceCommand,
  normalizeVoice,
  parseSpokenEmail,
  parseSpokenPassword,
  transformMessageForRecipient,
  validateAccountInput,
} from './lumiLogic';

test('normalizeVoice strips accents and normalizes casing', () => {
  assert.equal(normalizeVoice('  Lengua de Señas! '), 'lengua de senas!');
  assert.equal(normalizeVoice('Audiolibros'), 'audiolibros');
});

test('getPersonalGreeting adapts to identity and optional name', () => {
  assert.equal(getPersonalGreeting('Hombre', 'Mateo'), 'Hola amigo, Mateo');
  assert.equal(getPersonalGreeting('Mujer', 'Sofía'), 'Hola amiga, Sofía');
  assert.equal(getPersonalGreeting('No binario', ''), 'Hola, qué alegría tenerte aquí');
});

test('matchModeFromSpeech recognizes all four accessibility modes', () => {
  assert.equal(matchModeFromSpeech('Quiero usar modo ciego'), 'ciego');
  assert.equal(matchModeFromSpeech('soy muda'), 'mudo');
  assert.equal(matchModeFromSpeech('Modo sordo por favor'), 'sordo');
  assert.equal(matchModeFromSpeech('ninguna de ellas'), 'general');
  assert.equal(matchModeFromSpeech('hola mundo'), null);
});

test('matchIdentityFromSpeech handles identity options and omit', () => {
  assert.equal(matchIdentityFromSpeech('No binario'), 'No binario');
  assert.equal(matchIdentityFromSpeech('Prefiero no decirlo'), 'Prefiero no decirlo');
  assert.equal(matchIdentityFromSpeech('omitir'), 'omitir');
});

test('matchVoiceCommand maps navigation and playback commands', () => {
  assert.deepEqual(matchVoiceCommand('abrir audiolibros'), {
    type: 'navigate',
    section: 'audiolibros',
  });
  assert.deepEqual(matchVoiceCommand('quiero el traductor'), {
    type: 'navigate',
    section: 'traductor',
  });
  assert.deepEqual(matchVoiceCommand('detener lectura'), { type: 'stop_speaking' });
  assert.deepEqual(matchVoiceCommand('volver al menú'), {
    type: 'navigate',
    section: 'home',
  });
});

test('validateAccountInput enforces name, valid email, and password length', () => {
  assert.equal(
    validateAccountInput({
      name: 'E',
      email: 'elena@lumi.app',
      password: 'password123',
      isRegister: true,
    }).valid,
    false
  );
  assert.equal(
    validateAccountInput({
      name: 'Elena',
      email: 'not-an-email',
      password: 'password123',
      isRegister: true,
    }).valid,
    false
  );
  assert.equal(
    validateAccountInput({
      name: 'Elena',
      email: 'elena@lumi.app',
      password: '123',
      isRegister: true,
    }).valid,
    false
  );
  assert.equal(
    validateAccountInput({
      name: 'Elena',
      email: 'elena@lumi.app',
      password: 'password123',
      isRegister: true,
    }).valid,
    true
  );
});

test('decomposePhraseToSigns matches known glossary words and handles unknown tokens', () => {
  const steps = decomposePhraseToSigns('Hola, necesito ayuda gracias');
  assert.equal(steps.length, 4);
  assert.equal(steps[0].gloss, 'HOLA');
  assert.equal(steps[2].gloss, 'AYUDA');
  assert.equal(steps[3].gloss, 'GRACIAS');
});

test('buildLocalAccessibleTranslation formats lectura facil and pictogramas cleanly', () => {
  const easy = buildLocalAccessibleTranslation('Hola. Necesito ayuda ahora.', 'lectura_facil');
  assert.equal(easy.target, 'lectura_facil');
  assert.ok(easy.adaptedText.includes('• Hola.'));

  const picto = buildLocalAccessibleTranslation('Hola gracias agua', 'pictogramas');
  assert.equal(picto.pictograms.length, 3);
});

test('formatDuration and computeBookProgressPercent produce accurate tabular figures', () => {
  assert.equal(formatDuration(125), '02:05');
  assert.equal(formatDuration(0), '00:00');
  assert.equal(computeBookProgressPercent(0, 4, 50), 13);
  assert.equal(computeBookProgressPercent(3, 4, 100), 100);
});

test('expandCommonAbbreviations expands informal Spanish shorthand clearly', () => {
  assert.equal(expandCommonAbbreviations('Hola xfa dime q paso'), 'Hola por favor dime que paso');
  assert.equal(expandCommonAbbreviations('Llego en 10 hrs tb'), 'Llego en 10 horas también');
});

test('transformMessageForRecipient tailors output to ciego, sordo, mudo, and general modes', () => {
  const toCiego = transformMessageForRecipient('Hola xfa necesito ayuda', 'mudo', 'ciego');
  assert.equal(toCiego.recipientMode, 'ciego');
  assert.ok(toCiego.audioScript.includes('por favor necesito ayuda'));
  assert.ok(toCiego.tactileCue.includes('LumiCube'));

  const toSordo = transformMessageForRecipient('Hola, llegué a casa gracias', 'ciego', 'sordo');
  assert.equal(toSordo.recipientMode, 'sordo');
  assert.ok(toSordo.signGloss.length >= 3);
  assert.ok(toSordo.pictograms.length >= 2);
  assert.ok(toSordo.adaptedText.includes('• Hola.'));

  const toMudo = transformMessageForRecipient('¿Cómo estás hoy?', 'general', 'mudo');
  assert.equal(toMudo.recipientMode, 'mudo');
  assert.ok(toMudo.suggestedReplies.length >= 3);
});

test('parseSpokenEmail and parseSpokenPassword normalize voice dictation cleanly', () => {
  assert.equal(parseSpokenEmail('Dilan arroba gmail punto com'), 'dilan@gmail.com');
  assert.equal(parseSpokenEmail('elena guion bajo torres arroba hotmail punto es'), 'elena_torres@hotmail.es');
  assert.equal(parseSpokenPassword('  lumi 2026 sol  '), 'lumi2026sol');
});

