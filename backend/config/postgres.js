/**
 * Supabase client (HTTP-based, no direct DB connection)
 * ----------------------------------------------------
 * Instead of PostgreSQL connection pooling, Supabase uses
 * HTTP APIs which are stateless and naturally scalable.
 */

import { createClient } from '@supabase/supabase-js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('supabase')

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are not set')
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Generic query wrapper (NOT raw SQL)
 * ----------------------------------
 * Usage:
 *   const result = await db.select('period_reports', {
 *       eq: { user_id: userId }
 *   })
 */

async function select(table, { eq = {}, limit, single = false } = {}) {
    const start = Date.now()

    try {
        let query = supabase.from(table).select('*')

        // apply filters
        Object.entries(eq).forEach(([key, value]) => {
            query = query.eq(key, value)
        })

        if (limit) query = query.limit(limit)
        if (single) query = query.single()

        const { data, error } = await query

        if (error) throw error

        log.debug('query_executed', {
            durationMs: Date.now() - start,
            rows: Array.isArray(data) ? data.length : data ? 1 : 0,
        })

        return { rows: data }
    } catch (err) {
        log.error('query_failed', {
            error: err.message,
            durationMs: Date.now() - start,
        })
        throw err
    }
}

/**
 * Insert
 */
async function insert(table, values) {
    const start = Date.now()

    try {
        const { data, error } = await supabase
            .from(table)
            .insert(values)
            .select()

        if (error) throw error

        log.debug('insert_executed', {
            durationMs: Date.now() - start,
            rows: data.length,
        })

        return { rows: data }
    } catch (err) {
        log.error('insert_failed', {
            error: err.message,
            durationMs: Date.now() - start,
        })
        throw err
    }
}

/**
 * Update
 */
async function update(table, values, { eq = {} } = {}) {
    const start = Date.now()

    try {
        let query = supabase.from(table).update(values)

        Object.entries(eq).forEach(([key, value]) => {
            query = query.eq(key, value)
        })

        const { data, error } = await query.select()

        if (error) throw error

        log.debug('update_executed', {
            durationMs: Date.now() - start,
            rows: data.length,
        })

        return { rows: data }
    } catch (err) {
        log.error('update_failed', {
            error: err.message,
            durationMs: Date.now() - start,
        })
        throw err
    }
}

/**
 * Delete
 */
async function remove(table, { eq = {} } = {}) {
    const start = Date.now()

    try {
        let query = supabase.from(table).delete()

        Object.entries(eq).forEach(([key, value]) => {
            query = query.eq(key, value)
        })

        const { data, error } = await query

        if (error) throw error

        log.debug('delete_executed', {
            durationMs: Date.now() - start,
        })

        return { rows: data }
    } catch (err) {
        log.error('delete_failed', {
            error: err.message,
            durationMs: Date.now() - start,
        })
        throw err
    }
}

async function upsert(table, values, { onConflict = [] } = {}) {
    const start = Date.now()

    try {
        const { data, error } = await supabase
            .from(table)
            .upsert(values, {
                onConflict: onConflict.join(','),
            })
            .select()

        if (error) throw error

        log.debug('upsert_executed', {
            durationMs: Date.now() - start,
            rows: data.length,
        })

        return { rows: data }
    } catch (err) {
        log.error('upsert_failed', {
            error: err.message,
            durationMs: Date.now() - start,
        })
        throw err
    }
}

/**
 * RPC (for raw SQL via Postgres functions)
 * ---------------------------------------
 * Usage:
 *   const result = await db.rpc('function_name', { param: value })
 */
async function rpc(fn, params = {}) {
    const start = Date.now()

    try {
        const { data, error } = await supabase.rpc(fn, params)

        if (error) throw error

        log.debug('rpc_executed', {
            durationMs: Date.now() - start,
        })

        return { rows: data }
    } catch (err) {
        log.error('rpc_failed', {
            error: err.message,
            durationMs: Date.now() - start,
        })
        throw err
    }
}

/**
 * Health check
 */
export async function checkConnection() {
    try {
        const { error } = await supabase
            .from('period_reports')
            .select('id')
            .limit(1)

        if (error) throw error

        log.info('Supabase connection_ok')
    } catch (err) {
        log.error('connection_failed', { error: err.message })
        throw new Error(`Supabase connection failed: ${err.message}`)
    }
}

export const db = {
    select,
    insert,
    update,
    delete: remove,
    upsert,
    rpc,
}