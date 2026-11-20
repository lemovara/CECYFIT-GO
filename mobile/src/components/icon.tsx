import { Text, type ColorValue } from 'react-native';
const glyphs: Record<string,string> = {
  'home-outline':'⌂', home:'⌂', 'restaurant-outline':'◒', restaurant:'◒', 'fitness-outline':'♧', fitness:'♧', 'person-outline':'♙', person:'♙',
  'chevron-forward':'›', 'chevron-back':'‹', 'arrow-forward':'→', 'arrow-back':'←', 'heart':'♥', 'water-outline':'♧', 'barbell-outline':'⚒',
  'sunny-outline':'☼', 'nutrition-outline':'✿', 'moon-outline':'☾', 'cart-outline':'🛒', 'calendar-outline':'▦', 'book-outline':'▤',
  'information-circle-outline':'ⓘ', 'heart-outline':'♡', 'stats-chart-outline':'▥', 'settings-outline':'⚙', 'leaf-outline':'❧'
};
export function Ionicons({name,size=20,color='#1B2A4A'}:{name:string;size?:number;color?:ColorValue}) {
  return <Text style={{fontSize:size,color,fontWeight:'700',lineHeight:size+4}}>{glyphs[name] ?? '•'}</Text>;
}
