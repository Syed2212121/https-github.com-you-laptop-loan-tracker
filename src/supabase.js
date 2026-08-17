import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Missing Supabase credentials. Create a .env file in the project root with:\n' +
    'VITE_SUPABASE_URL=your-project-url\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// PostgREST caps a response at 1000 rows and gives no hint that it truncated.
// The SIMS roster is ~2,900 students and their laptops ~1,850, so a plain
// select() silently returns a third of the school and every lookup for a
// missing student fails. Page through with range() instead.
//
//   fetchAll(q => q.select("*").order("student_id"), "students")
//
export async function fetchAll(build, table, page = 1000) {
  const rows = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build(supabase.from(table)).range(from, from + page - 1)
    if (error) return { data: rows, error }
    rows.push(...data)
    if (data.length < page) return { data: rows, error: null }
  }
}
