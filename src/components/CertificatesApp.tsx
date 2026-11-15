import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckSquare,
  ExternalLink,
  FileCheck2,
  Globe,
  ShieldCheck,
  Square,
  Volume2,
} from 'lucide-react';
import type { AccessibilityMode } from '../types/lumi';
import { MODE_METADATA } from '../utils/lumiLogic';
import { speakWithBestVoice } from '../utils/speech';

interface CertificatesAppProps {
  mode: AccessibilityMode;
  onBack: () => void;
}

type CountryId = 'chile' | 'argentina' | 'espana' | 'mexico' | 'colombia' | 'peru';

interface CountryGuide {
  id: CountryId;
  name: string;
  flag: string;
  certificateName: string;
  organism: string;
  officialUrl: string;
  summary: string;
  steps: string[];
  documents: string[];
  generalBenefits: string[];
  byMode: Record<AccessibilityMode, { title: string; aids: string[]; tip: string }>;
}

const COUNTRY_GUIDES: Record<CountryId, CountryGuide> = {
  chile: {
    id: 'chile',
    name: 'Chile',
    flag: '🇨🇱',
    certificateName: 'Credencial de Discapacidad (RND)',
    organism: 'COMPIN + Registro Civil + SENADIS',
    officialUrl: 'https://www.senadis.gob.cl',
    summary:
      'La evaluación médica y social la realiza la COMPIN; luego el Registro Civil te inscribe en el Registro Nacional de la Discapacidad (RND) y emite tu Credencial gratuita.',
    steps: [
      'Solicita el Informe Biomédico Funcional y el Informe Social y de Redes de Apoyo en tu CESFAM o médico tratante.',
      'Ingresa la solicitud en línea en compin.cerofilas.gob.cl o presencialmente en la oficina COMPIN.',
      'Espera la calificación y resolución de la COMPIN (puedes revisar el estado con ClaveÚnica).',
      'Una vez aprobada, el Registro Civil emite automáticamente tu Credencial del RND.',
    ],
    documents: [
      'Cédula de identidad vigente',
      'Informe Biomédico Funcional firmado por médico',
      'Informe Social y de Redes de Apoyo (trabajador/a social)',
      'Informe de Desempeño (IVADEC-CIF) o antecedentes clínicos',
    ],
    generalBenefits: [
      'Postulación preferente a ayudas técnicas de SENADIS (sin costo según Registro Social de Hogares).',
      'Atenciones de Kinesiología, Terapia Ocupacional y Fonoaudiología en FONASA/Isapres sin tope anual.',
      'Inclusión laboral (Ley N° 21.015) y puntaje adicional en subsidios habitacionales MINVU.',
      'Rebajas arancelarias para vehículos adaptados y uso de estacionamientos exclusivos.',
    ],
    byMode: {
      ciego: {
        title: 'Apoyos clave para personas ciegas o con baja visión en Chile',
        aids: [
          'Ayudas técnicas SENADIS: bastón blanco/guiador, lector de pantalla, impresora o línea Braille y software magnificador.',
          'Acceso a audiolibros accesibles y capacitación en tiflotecnología mediante programas de inclusión.',
          'Pensión Básica Solidaria de Invalidez (PBSI) si cumples requisitos de edad y Registro Social de Hogares.',
        ],
        tip: 'Lumi puede leer en voz alta cada requisito. Usa ClaveÚnica para seguir tu trámite sin desplazarte.',
      },
      sordo: {
        title: 'Apoyos clave para personas sordas o con hipoacusia en Chile',
        aids: [
          'Financiamiento de audífonos digitales o accesorios de implante coclear a través de SENADIS y GES/AUGE.',
          'Derecho a interpretación en Lengua de Señas Chilena (LSCh) en trámites públicos y servicios de salud.',
          'Prioridad en acceso a subtítulos y tecnología de alerta luminosa/vibratoria en el hogar.',
        ],
        tip: 'Al acudir a COMPIN o Registro Civil puedes solicitar atención escrita o intérprete LSCh.',
      },
      mudo: {
        title: 'Apoyos clave para personas mudas o con discapacidad del habla en Chile',
        aids: [
          'Acceso a sesiones de Fonoaudiología en FONASA/Isapres sin tope anual de prestaciones.',
          'Postulación en SENADIS a comunicadores aumentativos y alternativos (tablets con síntesis de voz).',
          'Derecho a atención preferente y comunicación por escrito en oficinas del Estado.',
        ],
        tip: 'Puedes llevar tus respuestas escritas en Lumi y usar el botón de voz durante la evaluación en COMPIN.',
      },
      general: {
        title: 'Beneficios integrales y ayudas técnicas en Chile',
        aids: [
          'Programa de Ayudas Técnicas SENADIS: postulación anual para tecnología asistiva, prótesis y movilidad.',
          'Beca de Educación Superior para Estudiantes en Situación de Discapacidad.',
          'Exención de restricción vehicular en la Región Metropolitana para vehículos inscritos.',
        ],
        tip: 'Mantén actualizado tu Registro Social de Hogares para acceder al 100% de financiamiento en ayudas técnicas.',
      },
    },
  },
  argentina: {
    id: 'argentina',
    name: 'Argentina',
    flag: '🇦🇷',
    certificateName: 'Certificado Único de Discapacidad (CUD)',
    organism: 'ANDIS (Agencia Nacional de Discapacidad) y Juntas Evaluadoras',
    officialUrl: 'https://www.argentina.gob.ar/andis/cud',
    summary:
      'Documento público gratuito y válido en todo el país emitido por una Junta Evaluadora interdisciplinaria para garantizar cobertura integral de derechos.',
    steps: [
      'Consulta los requisitos y solicita turno en la Junta Evaluadora correspondiente a tu domicilio (o vía Mi Argentina).',
      'Reúne certificados médicos, estudios y planillas específicas según el tipo de discapacidad.',
      'Asiste a la entrevista con la Junta Evaluadora interdisciplinaria.',
      'Retira tu CUD físico o descárgalo en formato digital en la app Mi Argentina.',
    ],
    documents: [
      'DNI original y fotocopia',
      'Certificado médico actualizado (máximo 6 a 12 meses)',
      'Estudios complementarios (audiometría, campo visual, informes fonoaudiológicos, etc.)',
      'Planilla de solicitud según condición',
    ],
    generalBenefits: [
      'Cobertura del 100% en prestaciones básicas de salud, rehabilitación, medicación y tecnología asistiva.',
      'Transporte público terrestre gratuito (colectivos, trenes, subtes y media/larga distancia; con acompañante si corresponde).',
      'Asignaciones familiares diferenciales ANSES (Hijo con Discapacidad, Ayuda Escolar incrementada).',
      'Símbolo Internacional de Acceso para libre tránsito y estacionamiento + exenciones impositivas.',
    ],
    byMode: {
      ciego: {
        title: 'Beneficios prioritarios para discapacidad visual (CUD Argentina)',
        aids: [
          'Cobertura 100% por obra social/prepaga/Incluir Salud de bastones, lectores de pantalla, lupas electrónicas y rehabilitación visual.',
          'Acceso gratuito al transporte público con acompañante si la junta lo indica en el CUD.',
          'Derecho a ingreso con perro guía en cualquier espacio público o transporte.',
        ],
        tip: 'Puedes llevar tu CUD digital en Mi Argentina y pedir lectura de pantalla en cualquier oficina.',
      },
      sordo: {
        title: 'Beneficios prioritarios para discapacidad auditiva (CUD Argentina)',
        aids: [
          'Cobertura integral 100% de audífonos bilaterales, pilas/baterías, calibración e implantes cocleares.',
          'Sesiones ilimitadas de fonoaudiología y rehabilitación auditiva según prescripción médica.',
          'Derecho a intérprete de Lengua de Señas Argentina (LSA) en organismos públicos y justicia.',
        ],
        tip: 'Lleva la audiometría reciente firmada por especialista ORL al turno de la Junta Evaluadora.',
      },
      mudo: {
        title: 'Beneficios prioritarios para discapacidad del habla (CUD Argentina)',
        aids: [
          'Cobertura 100% de tratamientos fonoaudiológicos y comunicadores aumentativos/alternativos (CAA).',
          'Adaptación de trámites bancarios y públicos mediante comunicación escrita o asistida.',
          'Apoyo escolar y laboral con ajustes razonables garantizados por ley.',
        ],
        tip: 'Presenta informes fonoaudiológicos y neurológicos detallando las necesidades de comunicación.',
      },
      general: {
        title: 'Derechos generales del CUD en Argentina',
        aids: [
          'Programa Incluir Salud si cuentas con Pensión No Contributiva.',
          'Cupo laboral del 4% en el Estado nacional y franquicias para compra de vehículos adaptados.',
          'Exención de patente automotor y tasas municipales según jurisdicción.',
        ],
        tip: 'El trámite del CUD es siempre gratuito y no requiere gestores.',
      },
    },
  },
  espana: {
    id: 'espana',
    name: 'España',
    flag: '🇪🇸',
    certificateName: 'Certificado de Grado de Discapacidad (≥ 33%)',
    organism: 'Comunidades Autónomas / IMSERSO',
    officialUrl: 'https://www.imserso.es',
    summary:
      'El reconocimiento oficial igual o superior al 33% habilita prestaciones económicas, deducciones fiscales, empleo público reservado y productos de apoyo.',
    steps: [
      'Presenta la solicitud en el Centro Base de Atención a Personas con Discapacidad de tu Comunidad Autónoma.',
      'Adjunta informes médicos, psicológicos y sociales actualizados.',
      'Acude a la valoración del Equipo de Valoración y Orientación (EVO).',
      'Recibe la resolución oficial y solicita la Tarjeta Acreditativa del Grado de Discapacidad.',
    ],
    documents: [
      'DNI o NIE vigente',
      'Informes médicos y/o psicológicos recientes del sistema sanitario',
      'Formulario oficial de solicitud autonómica',
    ],
    generalBenefits: [
      'Reserva mínima del 7% de plazas en ofertas de empleo público y bonificaciones a la contratación.',
      'Deducciones en IRPF, IVA reducido (4%) en vehículos adaptados y exención del impuesto de matriculación.',
      'Subvenciones individuales para productos de apoyo y accesibilidad en el hogar.',
      'Prestación familiar por hijo a cargo y posibilidad de jubilación anticipada según grado.',
    ],
    byMode: {
      ciego: {
        title: 'Apoyos específicos para discapacidad visual en España',
        aids: [
          'Posibilidad de afiliación a la ONCE (según agudeza/campo visual) con tiflotecnología, perro guía y rehabilitación.',
          'Tarjeta de estacionamiento para movilidad reducida o acompañamiento según baremo.',
          'Subvenciones autonómicas para lectores de pantalla y adaptación del puesto de trabajo.',
        ],
        tip: 'Solicita copia de la resolución en formato accesible o lectura electrónica.',
      },
      sordo: {
        title: 'Apoyos específicos para discapacidad auditiva en España',
        aids: [
          'Ayudas autonómicas y de la Seguridad Social para audífonos y componentes externos de implante coclear.',
          'Servicio gratuito de videointerpretación en Lengua de Signos Española (SVIsual) y subtitulado.',
          'Adaptación de pruebas selectivas y oposiciones con tiempo adicional o intérprete.',
        ],
        tip: 'Con un 33% o más puedes acceder a bonos de telecomunicaciones accesibles.',
      },
      mudo: {
        title: 'Apoyos específicos para discapacidad del habla en España',
        aids: [
          'Financiamiento de comunicadores dinámicos y logopedia a través de cartera ortoprotésica y ayudas individuales.',
          'Ajustes razonables en entrevistas laborales y atención ciudadana multicanal por texto.',
          'Pensión no contributiva de invalidez si el grado alcanza el 65% y se cumplen requisitos de ingresos.',
        ],
        tip: 'Pide al EVO incluir las necesidades de comunicación aumentativa en el dictamen técnico.',
      },
      general: {
        title: 'Recursos estatales y autonómicos en España',
        aids: [
          'Tarjeta Dorada de Renfe con descuentos en trenes nacionales.',
          'Acceso prioritario a viviendas de protección pública adaptadas.',
          'Compatibilidad con Ley de Dependencia para asistencia personal.',
        ],
        tip: 'Revisa los plazos de tu Comunidad Autónoma, ya que las ayudas técnicas se convocan anualmente.',
      },
    },
  },
  mexico: {
    id: 'mexico',
    name: 'México',
    flag: '🇲🇽',
    certificateName: 'Certificado Electrónico de Discapacidad / Credencial CRENAPED',
    organism: 'Secretaría de Salud + DIF + Secretaría de Bienestar',
    officialUrl: 'https://www.gob.mx/bienestar',
    summary:
      'El Certificado de Discapacidad (NOM-039-SSA-2023) acredita la condición médica para acceder a la Pensión Bienestar y la Credencial Nacional del DIF.',
    steps: [
      'Acude a una institución pública de salud (IMSS, ISSSTE, Secretaría de Salud) para valoración y emisión del Certificado de Discapacidad.',
      'Tramita la Credencial Nacional para Personas con Discapacidad (CRENAPED) en módulos del DIF.',
      'Regístrate en los módulos de la Secretaría de Bienestar durante las convocatorias de la Pensión.',
    ],
    documents: [
      'Identificación oficial (INE o pasaporte)',
      'CURP actualizada y acta de nacimiento',
      'Certificado de Discapacidad Permanente emitido por institución pública de salud',
      'Comprobante de domicilio reciente',
    ],
    generalBenefits: [
      'Pensión para el Bienestar de las Personas con Discapacidad (apoyo económico bimestral).',
      'Descuentos en transporte público, predial, agua y servicios culturales con la credencial DIF.',
      'Programas de inclusión laboral y becas educativas específicas.',
    ],
    byMode: {
      ciego: {
        title: 'Apoyos para discapacidad visual en México',
        aids: [
          'Pensión Bienestar por discapacidad permanente visual.',
          'Acceso gratuito a centros de rehabilitación visual del DIF (braille, orientación y movilidad).',
          'Gratuidad o tarifa preferencial en transporte público urbano en diversas entidades.',
        ],
        tip: 'El certificado debe especificar discapacidad permanente para el registro en Bienestar.',
      },
      sordo: {
        title: 'Apoyos para discapacidad auditiva en México',
        aids: [
          'Campañas gratuitas de entrega de audífonos y valoración audiológica mediante DIF estatal/municipal.',
          'Derecho a intérpretes de Lengua de Señas Mexicana (LSM) en procesos legales y servicios públicos.',
          'Pensión Bienestar en entidades con cobertura universal.',
        ],
        tip: 'Pregunta en tu DIF local por las jornadas de aparatos auditivos sin costo.',
      },
      mudo: {
        title: 'Apoyos para discapacidad del habla en México',
        aids: [
          'Terapias de lenguaje y comunicación en Unidades Básicas de Rehabilitación (UBR) del DIF.',
          'Acceso a credenciales de identificación con datos de contacto y modo de comunicación.',
          'Inclusión en bolsas de trabajo adaptadas de la Secretaría del Trabajo.',
        ],
        tip: 'Puedes presentar este perfil de Lumi junto con tu credencial DIF en trámites presenciales.',
      },
      general: {
        title: 'Programas federales y locales en México',
        aids: [
          'Vales de medicamentos y atención en centros de rehabilitación física.',
          'Estímulos fiscales para empresas que contraten personas con discapacidad.',
        ],
        tip: 'Verifica si tu estado tiene convenio de universalidad para la Pensión Bienestar (0 a 64 años).',
      },
    },
  },
  colombia: {
    id: 'colombia',
    name: 'Colombia',
    flag: '🇨🇴',
    certificateName: 'Certificado de Discapacidad y Registro RLCPD',
    organism: 'Ministerio de Salud + Secretarías de Salud + IPS autorizadas',
    officialUrl: 'https://www.minsalud.gov.co',
    summary:
      'Se obtiene mediante valoración multidisciplinaria gratuita en una IPS autorizada por tu Secretaría de Salud e incluye inscripción en el RLCPD.',
    steps: [
      'Solicita la orden o remisión médica ante tu EPS (o directamente en Secretaría de Salud municipal/distrital).',
      'Asiste a la valoración por equipo multidisciplinario en la IPS autorizada.',
      'Recibe tu Certificado de Discapacidad y verifica tu registro en el RLCPD.',
    ],
    documents: [
      'Documento de identidad (Cédula o Tarjeta de Identidad)',
      'Historia clínica resumida y soportes diagnósticos',
      'Orden de valoración (cuando aplique por EPS)',
    ],
    generalBenefits: [
      'Priorización en programas de Prosperidad Social (Renta Ciudadana, Ingreso Mínimo Garantizado).',
      'Atención preferencial en salud dentro del PBS y entrega prioritaria de terapias y tecnologías de apoyo.',
      'Tarifas diferenciales o subsidios de transporte público según ciudad y Sisbén.',
    ],
    byMode: {
      ciego: {
        title: 'Apoyos para discapacidad visual en Colombia',
        aids: [
          'Programas del INCI (Instituto Nacional para Ciegos) y acceso gratuito a software lector de pantalla Convertic.',
          'Cobertura de rehabilitación integral y ayudas ópticas por PBS.',
        ],
        tip: 'El software lector de pantalla JAWS/ZoomText suele estar disponible gratis vía MinTIC Convertic.',
      },
      sordo: {
        title: 'Apoyos para discapacidad auditiva en Colombia',
        aids: [
          'Servicio gratuito de Centro de Relevo (MinTIC) para llamadas e interpretación en Lengua de Señas Colombiana (LSC).',
          'Cobertura de audífonos e implantes por EPS según prescripción.',
        ],
        tip: 'Regístrate en Centro de Relevo y usa Lumi para subtítulos presenciales.',
      },
      mudo: {
        title: 'Apoyos para discapacidad del habla en Colombia',
        aids: [
          'Terapia de fonoaudiología prioritaria en tu EPS y acceso a dispositivos de comunicación aumentativa.',
          'Ajustes razonables en educación (PIAR) y entornos laborales.',
        ],
        tip: 'Solicita que el certificado indique claramente el apoyo en comunicación requerido.',
      },
      general: {
        title: 'Beneficios generales en Colombia',
        aids: [
          'Cupos especiales en educación superior y SENA.',
          'Exención de pico y placa para vehículos que transportan personas con discapacidad (según municipio).',
        ],
        tip: 'El certificado no tiene costo y tu EPS/Secretaría de Salud no puede cobrar por la junta.',
      },
    },
  },
  peru: {
    id: 'peru',
    name: 'Perú',
    flag: '🇵🇪',
    certificateName: 'Certificado de Discapacidad y Carné del CONADIS',
    organism: 'MINSA / EsSalud + CONADIS',
    officialUrl: 'https://www.gob.pe/conadis',
    summary:
      'Primero obtienes el Certificado de Discapacidad en un establecimiento de salud autorizado y luego tramitas gratuitamente el Carné del CONADIS.',
    steps: [
      'Pide evaluación médica para Certificado de Discapacidad en un hospital MINSA, EsSalud o FF.AA.',
      'Con el certificado emitido, solicita tu inscripción y Carné en la plataforma virtual del CONADIS (Mi Registro en Todo el Perú).',
      'Descarga tu carné digital o recógelo en el módulo OMAPED de tu municipalidad.',
    ],
    documents: [
      'DNI vigente',
      'Certificado de Discapacidad original',
      'Fotografía digital (para trámite virtual CONADIS)',
    ],
    generalBenefits: [
      'Pase libre en transporte público urbano e interurbano (para discapacidad severa con carné amarillo).',
      'Pensión no contributiva del programa CONTIGO (para discapacidad severa en situación de pobreza).',
      'Cuota laboral (5% en sector público, 3% en privado) y bonificación del 15% en concursos públicos.',
    ],
    byMode: {
      ciego: {
        title: 'Apoyos para discapacidad visual en Perú',
        aids: [
          'Entrega gratuita de bastones guía y capacitación en centros OMAPED y CERE.',
          'Pase libre en Metropolitano, Metro de Lima y transporte autorizado con carné severo.',
        ],
        tip: 'Acércate a la OMAPED de tu distrito para recibir ayuda gratuita en el registro CONADIS.',
      },
      sordo: {
        title: 'Apoyos para discapacidad auditiva en Perú',
        aids: [
          'Derecho a intérprete de Lengua de Señas Peruana (LSP) en entidades públicas y centros de salud.',
          'Acceso a audífonos mediante SIS / EsSalud o campañas de CONADIS.',
        ],
        tip: 'Puedes usar Lumi en tus trámites presenciales para leer o dictar texto en pantalla.',
      },
      mudo: {
        title: 'Apoyos para discapacidad del habla en Perú',
        aids: [
          'Atención preferente en ventanillas del Estado y terapias de lenguaje por SIS/EsSalud.',
          'Bonificación en puntaje para postulaciones laborales y becas PRONABEC.',
        ],
        tip: 'El modo Mudo de Lumi te permite reproducir voz clara en consultas médicas o trámites.',
      },
      general: {
        title: 'Beneficios generales CONADIS en Perú',
        aids: [
          'Exoneración o descuentos en espectáculos culturales y deportivos.',
          'Acceso a programas de vivienda Techo Propio con prioridad.',
        ],
        tip: 'El carné del CONADIS puede tramitarse 100% gratis desde gob.pe/conadis.',
      },
    },
  },
};

const CHECKLIST_STORAGE_KEY = 'lumi_cert_checklist_v1';

export const CertificatesApp: React.FC<CertificatesAppProps> = ({ mode, onBack }) => {
  const [country, setCountry] = useState<CountryId>('chile');
  const [previewMode, setPreviewMode] = useState<AccessibilityMode>(mode);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    setPreviewMode(mode);
  }, [mode]);

  const guide = COUNTRY_GUIDES[country];
  const personal = guide.byMode[previewMode];

  const toggleDoc = (docKey: string) => {
    setCheckedDocs((prev) => {
      const next = { ...prev, [docKey]: !prev[docKey] };
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const completedCount = useMemo(() => {
    return guide.documents.filter((d) => checkedDocs[`${country}:${d}`]).length;
  }, [guide.documents, checkedDocs, country]);

  const handleSpeakGuide = () => {
    const text = [
      `Guía de certificado de discapacidad en ${guide.name}: ${guide.certificateName}.`,
      `Organismo: ${guide.organism}.`,
      guide.summary,
      `${personal.title}.`,
      ...personal.aids,
      `Consejo: ${personal.tip}`,
    ].join(' ');
    speakWithBestVoice(text);
  };

  return (
    <section aria-labelledby="cert-heading" className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al menú
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 id="cert-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
              Certificados de Discapacidad y Ayudas del Gobierno
            </h1>
            <p className="mt-1 text-sm text-[#555555]">
              Información oficial personalizada para tu modo{' '}
              <strong className="text-[#202020]">{MODE_METADATA[previewMode].label}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSpeakGuide}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#F5DF91] px-4 py-2 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Escuchar guía completa
          </button>
        </div>
      </div>

      {/* Selector de país y modo */}
      <div className="grid gap-4 rounded-2xl border border-[#E9E5D9] bg-[#FFFDF8] p-5 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-[#555555]">
            <Globe className="h-4 w-4 text-[#7D6618]" aria-hidden="true" />
            Selecciona tu país
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(COUNTRY_GUIDES) as CountryId[]).map((cid) => {
              const item = COUNTRY_GUIDES[cid];
              const active = country === cid;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setCountry(cid)}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                    active
                      ? 'border-[#8A6F1E] bg-[#F5DF91] text-[#202020]'
                      : 'border-[#E9E5D9] bg-white text-[#555555] hover:bg-[#F7F5EE]'
                  }`}
                >
                  <span className="mr-1.5">{item.flag}</span>
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-[#555555]">
            <ShieldCheck className="h-4 w-4 text-[#7D6618]" aria-hidden="true" />
            Personalizado según discapacidad
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['ciego', 'sordo', 'mudo', 'general'] as AccessibilityMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreviewMode(m)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                  previewMode === m
                    ? 'border-[#8A6F1E] bg-[#FFF9E9] text-[#202020] ring-1 ring-[#D9BF68]'
                    : 'border-[#E9E5D9] bg-white text-[#555555] hover:bg-[#F7F5EE]'
                }`}
              >
                {MODE_METADATA[m].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tarjeta principal del certificado */}
      <div className="rounded-2xl border border-[#D9BF68] bg-[#FFF9E9] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#7D6618]">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              {guide.flag} {guide.name} · {guide.organism}
            </span>
            <h2 className="mt-2 text-xl font-bold text-[#202020] sm:text-2xl">
              {guide.certificateName}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[#202020]">{guide.summary}</p>
          </div>
          <a
            href={guide.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#202020] px-4 py-2 text-xs font-bold text-white hover:bg-black"
          >
            Ir al portal oficial
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Ayudas personalizadas para tu discapacidad */}
      <div className="rounded-2xl border-2 border-[#D9BF68] bg-white p-6">
        <h2 className="text-lg font-bold text-[#202020]">{personal.title}</h2>
        <ul className="mt-3 space-y-2.5">
          {personal.aids.map((aid) => (
            <li
              key={aid}
              className="flex items-start gap-2.5 rounded-xl border border-[#E9E5D9] bg-[#FFFDF8] p-3 text-sm text-[#202020]"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#D9BF68]" aria-hidden="true" />
              <span>{aid}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-[#EBF6ED] px-4 py-3 text-xs font-semibold text-[#1E5629]">
          Consejo Lumi: {personal.tip}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pasos del trámite */}
        <div className="rounded-2xl border border-[#E9E5D9] bg-white p-5">
          <h2 className="text-lg font-bold text-[#202020]">Cómo tramitarlo paso a paso</h2>
          <ol className="mt-3 space-y-3">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm text-[#202020]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5DF91] text-xs font-extrabold text-[#202020]">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-[#555555]">
            Beneficios generales del certificado
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-[#555555]">
            {guide.generalBenefits.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        </div>

        {/* Checklist interactivo de documentos */}
        <div className="rounded-2xl border border-[#E9E5D9] bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#202020]">
              <FileCheck2 className="h-5 w-5 text-[#7D6618]" aria-hidden="true" />
              Checklist de documentos
            </h2>
            <span className="rounded-full bg-[#FFF9E9] px-3 py-1 text-xs font-bold text-[#7D6618]">
              {completedCount}/{guide.documents.length} listos
            </span>
          </div>
          <p className="mt-1 text-xs text-[#555555]">
            Marca los documentos que ya tienes reunidos (se guardan en tu dispositivo).
          </p>

          <div className="mt-4 space-y-2.5">
            {guide.documents.map((doc) => {
              const key = `${country}:${doc}`;
              const checked = Boolean(checkedDocs[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDoc(key)}
                  className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium transition ${
                    checked
                      ? 'border-[#2E7D32] bg-[#EBF6ED] text-[#1E5629]'
                      : 'border-[#E9E5D9] bg-[#FFFDF8] text-[#202020] hover:bg-[#F7F5EE]'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="h-5 w-5 shrink-0 text-[#1E5629]" aria-hidden="true" />
                  ) : (
                    <Square className="h-5 w-5 shrink-0 text-[#7D6618]" aria-hidden="true" />
                  )}
                  <span className={checked ? 'line-through' : ''}>{doc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
