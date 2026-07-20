// Town Hall level images sourced from the Clash of Clans Fandom "Town Hall" page.
// Each entry maps a Town Hall level to its portrait on the wiki.
const TOWN_HALL_IMAGES: Record<number, string> = {
  1: 'https://static.wikia.nocookie.net/clashofclans/images/f/fd/Town_Hall1.png/revision/latest/scale-to-width-down/150?cb=20170827034930',
  2: 'https://static.wikia.nocookie.net/clashofclans/images/7/7d/Town_Hall2.png/revision/latest/scale-to-width-down/150?cb=20170827050036',
  3: 'https://static.wikia.nocookie.net/clashofclans/images/d/dd/Town_Hall3.png/revision/latest/scale-to-width-down/150?cb=20170827050050',
  4: 'https://static.wikia.nocookie.net/clashofclans/images/e/e7/Town_Hall4.png/revision/latest/scale-to-width-down/150?cb=20170827050104',
  5: 'https://static.wikia.nocookie.net/clashofclans/images/a/a3/Town_Hall5.png/revision/latest/scale-to-width-down/150?cb=20170827050118',
  6: 'https://static.wikia.nocookie.net/clashofclans/images/5/52/Town_Hall6.png/revision/latest/scale-to-width-down/150?cb=20170827050220',
  7: 'https://static.wikia.nocookie.net/clashofclans/images/7/75/Town_Hall7.png/revision/latest/scale-to-width-down/150?cb=20170827051024',
  8: 'https://static.wikia.nocookie.net/clashofclans/images/f/fa/Town_Hall8.png/revision/latest/scale-to-width-down/150?cb=20170827051039',
  9: 'https://static.wikia.nocookie.net/clashofclans/images/e/e0/Town_Hall9.png/revision/latest/scale-to-width-down/150?cb=20170827045259',
  10: 'https://static.wikia.nocookie.net/clashofclans/images/5/5c/Town_Hall10.png/revision/latest/scale-to-width-down/150?cb=20170827040043',
  11: 'https://static.wikia.nocookie.net/clashofclans/images/9/96/Town_Hall11.png/revision/latest/scale-to-width-down/150?cb=20210410001514',
  12: 'https://static.wikia.nocookie.net/clashofclans/images/b/b7/Town_Hall12.png/revision/latest/scale-to-width-down/150?cb=20251008133316',
  13: 'https://static.wikia.nocookie.net/clashofclans/images/7/73/Town_Hall13.png/revision/latest/scale-to-width-down/150?cb=20251008133419',
  14: 'https://static.wikia.nocookie.net/clashofclans/images/b/b6/Town_Hall14.png/revision/latest/scale-to-width-down/150?cb=20251008133902',
  15: 'https://static.wikia.nocookie.net/clashofclans/images/d/d4/Town_Hall15.png/revision/latest/scale-to-width-down/150?cb=20251008075733',
  16: 'https://static.wikia.nocookie.net/clashofclans/images/5/53/Town_Hall16.png/revision/latest/scale-to-width-down/150?cb=20231211062744',
  17: 'https://static.wikia.nocookie.net/clashofclans/images/3/3f/Town_Hall17-5.png/revision/latest/scale-to-width-down/150?cb=20241122153251',
  18: 'https://static.wikia.nocookie.net/clashofclans/images/7/76/Town_Hall18.png/revision/latest/scale-to-width-down/150?cb=20251117162127',
};

export function getTownHallImageUrl(level: number | undefined | null): string | null {
  if (!level) return null;
  return TOWN_HALL_IMAGES[level] ?? null;
}
