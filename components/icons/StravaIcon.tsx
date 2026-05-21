export function StravaIcon({ size = 12, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.6" fillRule="evenodd" clipRule="evenodd" d="M4.97436 6.83333L7.53846 11L10 6.83333H8.46154L7.53846 8.40741L6.51282 6.83333H4.97436Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M5.28205 1L8.46154 6.83333H2L5.28205 1ZM5.28205 4.51852L6.51282 6.83333H3.94872L5.28205 4.51852Z" fill={color} />
    </svg>
  );
}
