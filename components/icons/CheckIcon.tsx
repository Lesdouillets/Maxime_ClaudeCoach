export function CheckIcon({ size = 12, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M9.61517 2.24038C10.0636 2.61224 10.1297 3.28214 9.76281 3.73663L5.8284 8.61003C5.64084 8.84235 5.36512 8.9835 5.06931 8.99865C4.77349 9.01379 4.48514 8.90151 4.27544 8.68952L2.30824 6.70089C1.89799 6.28618 1.89715 5.61294 2.30636 5.19718C2.71557 4.78142 3.37987 4.78057 3.79012 5.19528L4.93756 6.5L8.13877 2.39001C8.5057 1.93551 9.16671 1.86852 9.61517 2.24038Z" fill={color} />
    </svg>
  );
}
