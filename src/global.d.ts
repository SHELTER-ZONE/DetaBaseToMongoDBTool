import { Query } from 'mongoose'

declare global {
  type QueryType<T> = T extends Query<infer _, infer _, infer _, infer Q> ? Q : never
}