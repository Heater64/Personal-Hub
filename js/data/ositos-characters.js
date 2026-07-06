// js/data/puffy-characters.js
// Datos de personajes del mundo Ositos

export const OSITOS_CHARACTERS = [
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
  {
    id: '',
    name: '',
    role: '',
    description: '',
    color: '#',
    bgColor: '#',
    icon: '',
    image: '',
    favorite: false,
    story: '',
    personality: ['', '', '', '', ''],
    specialSkill: ''
  },
];

// Roles disponibles para filtros
export const ROLES = {
  todos: { label: 'TODOS', icon: '📋' },
  heroe: { label: 'HÉROES', icon: '⚔️' },
  villano: { label: 'VILLANOS', icon: '💀' },
  aliado: { label: 'ALIADOS', icon: '🤝' }
};

// Datos de personajes para el modal de selección rápida
export const CHARACTER_QUICK_DATA = OSITOS_CHARACTERS.map(char => ({
  id: char.id,
  name: char.name,
  role: char.role,
  icon: char.icon,
  color: char.color
}));