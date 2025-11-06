const clients = new Map() //key: noteId, value: Set of response objects

export const sseManager = {
    addClient(noteId, res) {
        if (!clients.has(noteId)) clients.set(noteId, new Set())
        clients.get(noteId).add(res)
    },

    removeClient(noteId, res) {
        const set = clients.get(noteId)
        if (!set) return
        set.delete(res)
        if (set.size === 0) clients.delete(noteId)
    },
    send(noteId, event) {
        const set = clients.get(noteId)
        if (!set) return

        const data = JSON.stringify(event)
        for (const res of set) {
            res.write(`data: ${data}\n\n`)
        }
    }
}