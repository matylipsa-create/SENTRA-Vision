export interface SentraState {
  filosofia: string;
  principios: string[];
  capas_implementadas: string[];
  parametros_por_defecto: Record<string, unknown>;
  perfil_usuario?: string;
  entorno?: string;
  estado_sistema?: string;
}

export interface SentraEvent {
  tipo: string;
  objeto?: string;
  confianza?: number;
  posicion?: string;
  distancia?: string;
  entorno?: string;
  estado_sistema?: string;
  perfil_usuario?: string;
  timestamp?: number;
}

export interface TCREIPrompt {
  Task: string;
  Context: string;
  Reference: string;
  Evaluate: string;
  Iterate: string;
}

const DEFAULT_SENTRA_STATE: SentraState = {
  filosofia: 'La IA sugiere, el humano decide.',
  principios: ['Veto humano', 'Procesamiento local', 'Soberanía del dato'],
  capas_implementadas: ['Detección visual', 'OCR', 'Adaptación al movimiento', 'Nodo de moral'],
  parametros_por_defecto: { idioma: 'es-AR', tono: 'claro y calmado' },
};

export function generateTCREIPrompt(
  eventData: SentraEvent,
  state: SentraState = DEFAULT_SENTRA_STATE,
): TCREIPrompt {
  const confidence =
    typeof eventData.confianza === 'number'
      ? `${Math.round(eventData.confianza * 100)}%`
      : 'no disponible';
  const location =
    [eventData.posicion, eventData.distancia].filter(Boolean).join(', ') ||
    'ubicación no disponible';

  return {
    Task: `Describe de forma breve y accionable el ${eventData.tipo}${
      eventData.objeto ? ` detectado: ${eventData.objeto}` : ''
    }. Prioriza la seguridad del usuario y no inventes información.`,
    Context: [
      `Perfil del usuario: ${eventData.perfil_usuario ?? state.perfil_usuario ?? 'persona que necesita asistencia visual'}.`,
      `Entorno: ${eventData.entorno ?? state.entorno ?? 'no especificado'}.`,
      `Estado del sistema: ${eventData.estado_sistema ?? state.estado_sistema ?? 'operativo'}.`,
      `Posición relativa: ${location}.`,
      `Confianza de detección: ${confidence}.`,
      eventData.timestamp
        ? `Momento de detección: ${new Date(eventData.timestamp).toISOString()}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    Reference: [
      `Filosofía: ${state.filosofia}`,
      `Principios: ${state.principios.join('; ')}`,
      `Capas disponibles: ${state.capas_implementadas.join('; ')}`,
      `Parámetros por defecto: ${JSON.stringify(state.parametros_por_defecto)}`,
    ].join('. '),
    Evaluate:
      'La respuesta debe ser clara, breve, útil para orientación por voz, indicar incertidumbre cuando corresponda y evitar atributos sensibles o identificaciones biométricas.',
    Iterate:
      'Si la confianza es baja o falta contexto, formula una advertencia prudente y solicita confirmación. Si el usuario pide repetir, reformula en una sola frase más corta.',
  };
}

export function tcreiPromptToText(prompt: TCREIPrompt): string {
  return [
    `TAREA:\n${prompt.Task}`,
    `CONTEXTO:\n${prompt.Context}`,
    `REFERENCIA:\n${prompt.Reference}`,
    `EVALUAR:\n${prompt.Evaluate}`,
    `ITERAR:\n${prompt.Iterate}`,
  ].join('\n\n');
}
