import { createContext, useReducer, useEffect, ReactNode } from "react";

//笔记数据类型
type Note = {
    id: string;
    title: string;
    content: string;
    date: string;
    category: 'meeting' | 'study' | 'interview'
}

//定义State类型
type NoteState = {
    notes: Note[]
}

//定义NoteAction类型
type NoteAction = { type: 'ADD_NOTE'; payload: Note }
    | { type: 'UPDATE_NOTE'; payload: Note }
    | { type: 'DELETE_NOTE'; payload: string }
    | { type: 'LOAD_NOTES'; payload: Note[] }

//Reducer
const noteReducer = (state: NoteState, action: NoteAction): NoteState => {
    switch (action.type) {
        case 'ADD_NOTE':
            const updatedNotes = [...state.notes, action.payload]
            localStorage.setItem('notes', JSON.stringify(updatedNotes))
            return { notes: updatedNotes };
        case 'UPDATE_NOTE':
            const modifiedNotes = state.notes.map((note) =>
                note.id === action.payload.id ? action.payload : note)
            localStorage.setItem('notes', JSON.stringify(modifiedNotes))
            return { notes: modifiedNotes }
        case 'DELETE_NOTE':
            const filteredNotes = state.notes.filter((note) => note.id !== action.payload)
            localStorage.setItem('notes', JSON.stringify(filteredNotes))
            return { notes: filteredNotes }
        case 'LOAD_NOTES':
            return { notes: action.payload }
        default:
            return state
    }
}

const NoteContext = createContext<{
    state: NoteState;
    dispatch: React.Dispatch<NoteAction>
} | null>(null)

export const NoteProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(noteReducer, { notes: [] })

    //从localStorage中加载笔记
    useEffect(() => {
        const storedNotes = localStorage.getItem('notes')
        if (storedNotes) {
            dispatch({ type: 'LOAD_NOTES', payload: JSON.parse(storedNotes) })
        }
    }, [])

    return (
        <NoteContext.Provider value={{ state, dispatch }}>
            {children}
        </NoteContext.Provider>
    )
}

export default NoteContext;