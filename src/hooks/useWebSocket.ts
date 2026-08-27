import { useState, useEffect, useRef } from 'react'

interface UseWebSocketReturn {
    isConnected: boolean
    lastMessage: any
    send: (data: any) => void
}

export function useWebSocket(url: string): UseWebSocketReturn {
    const [isConnected, setIsConnected] = useState(false)
    const [lastMessage, setLastMessage] = useState<any>(null)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('WebSocket connected')
            setIsConnected(true)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                setLastMessage(data)
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error)
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
        }

        ws.onclose = () => {
            console.log('WebSocket disconnected')
            setIsConnected(false)
        }

        return () => {
            ws.close()
        }
    }, [url])

    const send = (data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data))
        }
    }

    return { isConnected, lastMessage, send }
}
