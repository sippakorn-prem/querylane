import { siPostgresql, siMysql } from "simple-icons"

function SimpleIcon({
  icon,
  className,
}: {
  icon: { path: string; hex: string; title: string }
  className?: string
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      fill={`#${icon.hex}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  )
}

export function PostgresIcon({ className }: { className?: string }) {
  return <SimpleIcon icon={siPostgresql} className={className} />
}

export function MySQLIcon({ className }: { className?: string }) {
  return <SimpleIcon icon={siMysql} className={className} />
}

export function DbIcon({ dbType, className }: { dbType: string; className?: string }) {
  if (dbType === "postgres") return <PostgresIcon className={className} />
  if (dbType === "mysql") return <MySQLIcon className={className} />
  return null
}
