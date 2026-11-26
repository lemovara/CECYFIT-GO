// Names are curated in Spanish; IDs reference the original free-exercise-db records.
export const exercisePresets = [
  ['Press de banca', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Press de banca inclinado', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['Press de banca declinado', 'Decline_Barbell_Bench_Press'],
  ['Flexiones', 'Pushups'], ['Dominadas', 'Pullups'], ['Dominadas asistidas con banda', 'Band_Assisted_Pull-Up'],
  ['Remo con dos mancuernas', 'Bent_Over_Two-Dumbbell_Row'], ['Remo con una mancuerna', 'One-Arm_Dumbbell_Row'],
  ['Jalón frontal con agarre cerrado', 'Close-Grip_Front_Lat_Pulldown'],
  ['Press de hombro con mancuernas', 'Dumbbell_Shoulder_Press'], ['Press Arnold', 'Arnold_Dumbbell_Press'],
  ['Elevaciones laterales', 'Side_Lateral_Raise'], ['Curl de bíceps', 'Barbell_Curl'],
  ['Curl inclinado alternado', 'Alternate_Incline_Dumbbell_Curl'], ['Extensión de tríceps en polea', 'Triceps_Pushdown'],
  ['Sentadilla', 'Bodyweight_Squat'], ['Sentadilla con barra', 'Barbell_Squat'], ['Sentadilla a silla', 'Chair_Squat'],
  ['Peso muerto con barra', 'Barbell_Deadlift'], ['Peso muerto rumano', 'Romanian_Deadlift'],
  ['Desplantes con mancuernas', 'Dumbbell_Lunges'], ['Desplantes caminando', 'Bodyweight_Walking_Lunge'],
  ['Prensa de piernas', 'Leg_Press'], ['Extensión de piernas', 'Leg_Extensions'],
  ['Curl de piernas acostado', 'Lying_Leg_Curls'], ['Elevación de pantorrillas de pie', 'Standing_Calf_Raises'],
  ['Plancha', 'Plank'], ['Abdominales', 'Crunches'], ['Abdominales en polea', 'Cable_Crunch'],
  ['Escaladores', 'Mountain_Climbers'],
] as const;

export const exerciseImageUrl = (id: string, phase: 0 | 1) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/${phase}.jpg`;
