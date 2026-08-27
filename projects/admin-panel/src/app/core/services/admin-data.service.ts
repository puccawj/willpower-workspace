export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter((w) => w[0] !== '’')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = ['#a94b2c', '#b98a32', '#7c9068', '#8a5a2e', '#5a6b8a', '#9c6a8a'];

export function avatarColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
