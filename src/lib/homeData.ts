import { supabase } from './supabase'

export interface HabitHistory { [key: string]: 0 | 1 }
export interface Habit  { id: string; name: string; glyph: string; glyphCls: string; sub: string; history: HabitHistory }
export interface Task   { id: string; text: string; tag: string; tagCls: string; done: boolean }
export interface ReflectEntry { text: string; mood: number }
export type ReflectStore = { [key: string]: ReflectEntry }

export interface HomeData {
  habits:  Habit[]
  tasks:   Task[]
  reflect: ReflectStore
}

export async function loadHomeData(userId: string): Promise<HomeData | null> {
  const { data, error } = await supabase
    .from('home_data')
    .select('habits, tasks, reflect')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { habits: data.habits as Habit[], tasks: data.tasks as Task[], reflect: data.reflect as ReflectStore }
}

export async function saveHomeData(userId: string, data: HomeData): Promise<void> {
  const { error } = await supabase.from('home_data').upsert({
    user_id:    userId,
    habits:     data.habits,
    tasks:      data.tasks,
    reflect:    data.reflect,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
