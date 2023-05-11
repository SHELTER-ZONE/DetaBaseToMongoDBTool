import type { Query } from 'mongoose'

declare global {
  type QueryType<T> = T extends Query<unknown, unknown, unknown, infer Q> ? Q : never
  type DetaSZDailyCheckGuild = { guildID: string; key: string; members: DetaSZDailyCheck[] }[]
}