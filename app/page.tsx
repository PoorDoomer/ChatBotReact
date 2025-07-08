"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  SettingsIcon,
  Trash2,
  MessageSquare,
  Plus,
  Menu,
  X,
  RefreshCw,
  Zap,
  Eye,
  Search,
  Filter,
  ImageIcon,
  RotateCcw,
  Maximize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
  timestamp: number
  status?: "sending" | "success" | "error"
  error?: string
  retryData?: {
    originalInput: string
    images: string[]
    conversationId: string
  }
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface ChatSettings {
  apiKey: string
  model: string
  persona: string
}

interface ModelData {
  id: string
  name: string
  created: number
  description: string
  architecture: {
    input_modalities: string[]
    output_modalities: string[]
    tokenizer: string
  }
  top_provider: {
    is_moderated: boolean
  }
  pricing: {
    prompt: string
    completion: string
    image: string
    request: string
    web_search: string
    internal_reasoning: string
  }
  canonical_slug: string
  context_length: number
  hugging_face_id: string
  per_request_limits: Record<string, any>
  supported_parameters: string[]
}

interface ModelsResponse {
  data: ModelData[]
}

interface ModelFilters {
  showFreeOnly: boolean
  showVisionOnly: boolean
  showModeratedOnly: boolean
}

export default function MatrixChatbot() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState<ModelData[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState("")
  const [modelFilters, setModelFilters] = useState<ModelFilters>({
    showFreeOnly: false,
    showVisionOnly: false,
    showModeratedOnly: false,
  })
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [viewerImageSrc, setViewerImageSrc] = useState("")
  const [settings, setSettings] = useState<ChatSettings>({
    apiKey: "",
    model: "",
    persona:
      "You are NEURAL.AI - a cyberpunk AI assistant. Be concise, direct, and slightly mysterious. Use technical terminology when appropriate.",
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentConversation = conversations.find((c) => c.id === currentConversationId)
  const messages = currentConversation?.messages || []

  // Load data from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem("matrix-conversations")
    const savedSettings = localStorage.getItem("matrix-chat-settings")
    const savedCurrentId = localStorage.getItem("matrix-current-conversation")
    const savedModels = localStorage.getItem("matrix-models")

    if (savedConversations) {
      const parsedConversations = JSON.parse(savedConversations)
      setConversations(parsedConversations)

      if (savedCurrentId && parsedConversations.find((c: Conversation) => c.id === savedCurrentId)) {
        setCurrentConversationId(savedCurrentId)
      } else if (parsedConversations.length > 0) {
        setCurrentConversationId(parsedConversations[0].id)
      }
    }

    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }

    if (savedModels) {
      setModels(JSON.parse(savedModels))
    } else {
      fetchModels()
    }
  }, [])

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem("matrix-conversations", JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    localStorage.setItem("matrix-chat-settings", JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("matrix-current-conversation", currentConversationId)
    }
  }, [currentConversationId])

  useEffect(() => {
    localStorage.setItem("matrix-models", JSON.stringify(models))
  }, [models])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchModels = async () => {
    setIsLoadingModels(true)
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models")
      if (!response.ok) {
        throw new Error("Failed to fetch models")
      }
      const data: ModelsResponse = await response.json()

      // Sort models: free first, then by name
      const sortedModels = data.data.sort((a, b) => {
        const aIsFree = Number.parseFloat(a.pricing.prompt) === 0 && Number.parseFloat(a.pricing.completion) === 0
        const bIsFree = Number.parseFloat(b.pricing.prompt) === 0 && Number.parseFloat(b.pricing.completion) === 0

        if (aIsFree && !bIsFree) return -1
        if (!aIsFree && bIsFree) return 1
        return a.name.localeCompare(b.name)
      })

      setModels(sortedModels)

      // Set default model if none selected
      if (!settings.model && sortedModels.length > 0) {
        const defaultModel =
          sortedModels.find(
            (m) => Number.parseFloat(m.pricing.prompt) === 0 && Number.parseFloat(m.pricing.completion) === 0,
          ) || sortedModels[0]
        setSettings((prev) => ({ ...prev, model: defaultModel.id }))
      }
    } catch (error) {
      console.error("Error fetching models:", error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  const filteredModels = models.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      model.description.toLowerCase().includes(modelSearch.toLowerCase())

    if (!matchesSearch) return false

    const isFree = Number.parseFloat(model.pricing.prompt) === 0 && Number.parseFloat(model.pricing.completion) === 0
    const hasVision = model.architecture.input_modalities.includes("image")
    const isModerated = model.top_provider.is_moderated

    if (modelFilters.showFreeOnly && !isFree) return false
    if (modelFilters.showVisionOnly && !hasVision) return false
    if (modelFilters.showModeratedOnly && !isModerated) return false

    return true
  })

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: "NEW.SESSION",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setConversations((prev) => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
    setIsSidebarOpen(false)
  }

  const updateConversationTitle = (conversationId: string, firstMessage: string) => {
    const title =
      firstMessage
        .slice(0, 30)
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "") + (firstMessage.length > 30 ? "..." : "")

    setConversations((prev) =>
      prev.map((conv) => (conv.id === conversationId ? { ...conv, title: title || "UNTITLED.SESSION" } : conv)),
    )
  }

  const deleteConversation = (conversationId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId))

    if (currentConversationId === conversationId) {
      const remaining = conversations.filter((c) => c.id !== conversationId)
      setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          setSelectedImages((prev) => [...prev, result])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const openImageViewer = (imageSrc: string) => {
    setViewerImageSrc(imageSrc)
    setImageViewerOpen(true)
  }

  const updateMessageStatus = (messageId: string, status: Message["status"], error?: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) => (msg.id === messageId ? { ...msg, status, error } : msg)),
            }
          : conv,
      ),
    )
  }

  const retryMessage = async (message: Message) => {
    if (!message.retryData) return

    const { originalInput, images, conversationId } = message.retryData

    // Update message status to sending
    updateMessageStatus(message.id, "sending")

    try {
      await sendMessageInternal(originalInput, images, conversationId, message.id)
    } catch (error) {
      console.error("Retry failed:", error)
    }
  }

  const sendMessageInternal = async (
    messageText: string,
    images: string[] = [],
    conversationId: string,
    retryMessageId?: string,
  ) => {
    const selectedModel = models.find((m) => m.id === settings.model)
    const hasVision = selectedModel?.architecture.input_modalities.includes("image")

    // Prepare message content based on model capabilities
    let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>

    if (hasVision && images.length > 0) {
      // Multimodal message with images
      messageContent = [
        { type: "text", text: messageText },
        ...images.map((imageUrl) => ({
          type: "image_url",
          image_url: { url: imageUrl },
        })),
      ]
    } else {
      // Text-only message
      messageContent = messageText
    }

    // If this is a retry, update the existing message, otherwise create new one
    if (retryMessageId) {
      updateMessageStatus(retryMessageId, "sending")
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageContent,
        timestamp: Date.now(),
        status: "success",
      }

      // Update conversation with user message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: [...conv.messages, userMessage],
                updatedAt: Date.now(),
              }
            : conv,
        ),
      )
    }

    // Update title if this is the first message
    const currentConv = conversations.find((c) => c.id === conversationId)
    if (!currentConv || currentConv.messages.length === 0) {
      updateConversationTitle(conversationId, messageText)
    }

    try {
      // Prepare messages for API - convert complex content to simple format for history
      const currentMessages = conversations.find((c) => c.id === conversationId)?.messages || []
      const apiMessages = currentMessages
        .filter((m) => m.status !== "error") // Exclude error messages from context
        .map((m) => {
          if (typeof m.content === "string") {
            return { role: m.role, content: m.content }
          } else {
            // For multimodal messages, extract text content for history
            const textContent = m.content.find((item) => item.type === "text")?.text || ""
            return { role: m.role, content: textContent }
          }
        })

      // Prepare the current message for API
      let currentMessageForAPI: any
      if (hasVision && images.length > 0) {
        currentMessageForAPI = {
          role: "user",
          content: messageContent,
        }
      } else {
        currentMessageForAPI = {
          role: "user",
          content: messageText,
        }
      }

      console.log("Sending API request with:", {
        model: settings.model,
        messageCount: apiMessages.length + 2, // +1 for system, +1 for current
        hasImages: hasVision && images.length > 0,
      })

      const requestBody = {
        model: settings.model,
        messages: [{ role: "system", content: settings.persona }, ...apiMessages, currentMessageForAPI],
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Matrix Neural Interface",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error Response:", errorText)

        let errorMessage = "NEURAL.LINK.COMPROMISED"
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error?.message) {
            errorMessage = `API ERROR: ${errorData.error.message}`
          }
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid API response format")
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.choices[0].message.content,
        timestamp: Date.now(),
        status: "success",
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: [...conv.messages, assistantMessage],
                updatedAt: Date.now(),
              }
            : conv,
        ),
      )

      // If this was a retry, mark the original message as success
      if (retryMessageId) {
        updateMessageStatus(retryMessageId, "success")
      }
    } catch (error) {
      console.error("Detailed error:", error)

      let errorMessage = "ERROR: NEURAL.LINK.COMPROMISED - Unknown error occurred."

      if (error instanceof Error) {
        errorMessage = `ERROR: ${error.message}`
      }

      if (retryMessageId) {
        // Update the retry message with error
        updateMessageStatus(retryMessageId, "error", errorMessage)
      } else {
        // Create new error message
        const errorResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMessage,
          timestamp: Date.now(),
          status: "error",
          retryData: {
            originalInput: messageText,
            images: images,
            conversationId: conversationId,
          },
        }

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, errorResponse],
                  updatedAt: Date.now(),
                }
              : conv,
          ),
        )
      }
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !settings.apiKey || !settings.model) {
      console.log("Missing required fields:", {
        input: !!input.trim(),
        apiKey: !!settings.apiKey,
        model: !!settings.model,
      })
      return
    }

    let conversationId = currentConversationId

    // Create new conversation if none exists
    if (!conversationId) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: "NEW.SESSION",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setConversations((prev) => [newConversation, ...prev])
      conversationId = newConversation.id
      setCurrentConversationId(conversationId)
    }

    const originalInput = input
    const originalImages = [...selectedImages]

    setInput("")
    setSelectedImages([])
    setIsLoading(true)

    try {
      await sendMessageInternal(originalInput, originalImages, conversationId)
    } catch (error) {
      console.error("Send message failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatPrice = (price: string) => {
    const num = Number.parseFloat(price)
    if (num === 0) return "FREE"
    if (num < 0.000001) return `${(num * 1000000).toFixed(2)}µ`
    if (num < 0.001) return `${(num * 1000).toFixed(2)}m`
    return `$${num.toFixed(6)}`
  }

  const getSelectedModel = () => {
    return models.find((m) => m.id === settings.model)
  }

  const renderMessageContent = (
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  ) => {
    if (typeof content === "string") {
      return content
    }

    return (
      <div className="space-y-2">
        {content.map((item, index) => {
          if (item.type === "text") {
            return <div key={index}>{item.text}</div>
          }
          if (item.type === "image_url" && item.image_url) {
            return (
              <div key={index} className="mt-2">
                <motion.img
                  src={item.image_url.url || "/placeholder.svg"}
                  alt="Uploaded content"
                  className="max-w-xs rounded border-2 border-gray-300 cursor-pointer hover:border-black transition-colors"
                  onClick={() => openImageViewer(item.image_url?.url || "")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                />
                <div className="flex items-center mt-1 text-xs opacity-60">
                  <Maximize2 className="w-3 h-3 mr-1" />
                  CLICK.TO.EXPAND
                </div>
              </div>
            )
          }
          return null
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black overflow-hidden relative">
      {/* Matrix-style animated background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-px bg-green-500/20"
            style={{
              left: `${(i * 5) % 100}%`,
              height: "100%",
            }}
            animate={{
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Number.POSITIVE_INFINITY,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="bg-black border-2 border-white text-white max-w-4xl max-h-[90vh] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Viewer</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img
              src={viewerImageSrc || "/placeholder.svg"}
              alt="Full size view"
              className="max-w-full max-h-[80vh] object-contain rounded"
            />
          </div>
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => setImageViewerOpen(false)}
              className="bg-white text-black hover:bg-gray-200 font-mono"
            >
              CLOSE.VIEWER
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 bg-white border-r-2 border-black z-50 flex flex-col"
            >
              <div className="p-4 border-b-2 border-black">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-lg font-bold">NEURAL.HISTORY</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSidebarOpen(false)}
                    className="hover:bg-black/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  onClick={createNewConversation}
                  className="w-full bg-black text-white hover:bg-gray-800 font-mono"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  NEW.SESSION
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <motion.div
                      key={conversation.id}
                      whileHover={{ x: 4 }}
                      className={`group p-3 rounded border-2 cursor-pointer transition-all ${
                        currentConversationId === conversation.id
                          ? "border-black bg-black text-white"
                          : "border-gray-300 hover:border-black"
                      }`}
                      onClick={() => {
                        setCurrentConversationId(conversation.id)
                        setIsSidebarOpen(false)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-bold truncate">{conversation.title}</p>
                          <p className="text-xs opacity-60 font-mono">{conversation.messages.length} MSGS</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteConversation(conversation.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 border-b-2 border-black bg-white/80 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(true)} className="hover:bg-black/10">
              <Menu className="w-4 h-4" />
            </Button>

            <div className="flex items-center space-x-3">
              <motion.div
                className="w-8 h-8 bg-black border-2 border-black"
                whileHover={{ rotate: 45 }}
                transition={{ duration: 0.3 }}
              />
              <h1 className="text-xl font-mono font-bold tracking-wider">NEURAL.MATRIX</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Current model indicator */}
            {getSelectedModel() && (
              <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-gray-100 border border-gray-300 rounded font-mono text-xs">
                <Zap className="w-3 h-3" />
                <span className="font-bold">{getSelectedModel()?.name.slice(0, 20)}</span>
                {Number.parseFloat(getSelectedModel()?.pricing.prompt || "0") === 0 && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                    FREE
                  </Badge>
                )}
                {getSelectedModel()?.architecture.input_modalities.includes("image") && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                    <Eye className="w-3 h-3" />
                  </Badge>
                )}
              </div>
            )}

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="hover:bg-black/10 font-mono">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  CONFIG
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-2 border-black text-black max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="font-mono font-bold">SYSTEM.CONFIGURATION</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-6 pr-4">
                    <div>
                      <Label htmlFor="apiKey" className="text-sm font-mono font-bold">
                        API.KEY
                      </Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) => setSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
                        className="bg-gray-50 border-2 border-gray-300 focus:border-black font-mono"
                        placeholder="sk-or-v1-..."
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="model" className="text-sm font-mono font-bold">
                          NEURAL.MODEL
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={fetchModels}
                          disabled={isLoadingModels}
                          className="font-mono text-xs"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingModels ? "animate-spin" : ""}`} />
                          REFRESH
                        </Button>
                      </div>

                      {/* Search and Filter Controls */}
                      <div className="space-y-3 mb-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="SEARCH.MODELS..."
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            className="pl-10 bg-gray-50 border-2 border-gray-300 focus:border-black font-mono text-sm"
                          />
                        </div>

                        <div className="flex items-center space-x-4 p-3 bg-gray-50 border border-gray-300 rounded">
                          <div className="flex items-center space-x-2">
                            <Filter className="w-4 h-4" />
                            <span className="font-mono text-xs font-bold">FILTERS:</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Checkbox
                              id="free-only"
                              checked={modelFilters.showFreeOnly}
                              onCheckedChange={(checked) =>
                                setModelFilters((prev) => ({ ...prev, showFreeOnly: !!checked }))
                              }
                            />
                            <Label htmlFor="free-only" className="font-mono text-xs cursor-pointer">
                              FREE
                            </Label>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Checkbox
                              id="vision-only"
                              checked={modelFilters.showVisionOnly}
                              onCheckedChange={(checked) =>
                                setModelFilters((prev) => ({ ...prev, showVisionOnly: !!checked }))
                              }
                            />
                            <Label htmlFor="vision-only" className="font-mono text-xs cursor-pointer">
                              VISION
                            </Label>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Checkbox
                              id="moderated-only"
                              checked={modelFilters.showModeratedOnly}
                              onCheckedChange={(checked) =>
                                setModelFilters((prev) => ({ ...prev, showModeratedOnly: !!checked }))
                              }
                            />
                            <Label htmlFor="moderated-only" className="font-mono text-xs cursor-pointer">
                              SAFE
                            </Label>
                          </div>
                        </div>
                      </div>

                      <Select
                        value={settings.model}
                        onValueChange={(value) => setSettings((prev) => ({ ...prev, model: value }))}
                      >
                        <SelectTrigger className="bg-gray-50 border-2 border-gray-300 focus:border-black font-mono">
                          <SelectValue placeholder="SELECT.MODEL..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-2 border-black max-h-80">
                          {filteredModels.length === 0 ? (
                            <div className="p-4 text-center font-mono text-sm text-gray-500">NO.MODELS.FOUND</div>
                          ) : (
                            filteredModels.map((model) => {
                              const isFree =
                                Number.parseFloat(model.pricing.prompt) === 0 &&
                                Number.parseFloat(model.pricing.completion) === 0
                              const hasVision = model.architecture.input_modalities.includes("image")

                              return (
                                <SelectItem key={model.id} value={model.id} className="font-mono">
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-bold">{model.name}</span>
                                        {isFree && (
                                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                            FREE
                                          </Badge>
                                        )}
                                        {hasVision && (
                                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                            <Eye className="w-3 h-3 mr-1" />
                                            VISION
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-600 mt-1">
                                        CTX: {model.context_length.toLocaleString()} | IN:{" "}
                                        {formatPrice(model.pricing.prompt)}/1K | OUT:{" "}
                                        {formatPrice(model.pricing.completion)}/1K
                                      </div>
                                    </div>
                                  </div>
                                </SelectItem>
                              )
                            })
                          )}
                        </SelectContent>
                      </Select>

                      {/* Selected model details */}
                      {getSelectedModel() && (
                        <div className="mt-3 p-3 bg-gray-50 border border-gray-300 rounded font-mono text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-bold">CONTEXT:</span>{" "}
                              {getSelectedModel()?.context_length.toLocaleString()}
                            </div>
                            <div>
                              <span className="font-bold">MODERATED:</span>{" "}
                              {getSelectedModel()?.top_provider.is_moderated ? "YES" : "NO"}
                            </div>
                            <div>
                              <span className="font-bold">INPUT:</span>{" "}
                              {getSelectedModel()?.architecture.input_modalities.join(", ").toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold">OUTPUT:</span>{" "}
                              {getSelectedModel()?.architecture.output_modalities.join(", ").toUpperCase()}
                            </div>
                          </div>
                          {getSelectedModel()?.description && (
                            <div className="mt-2 pt-2 border-t border-gray-300">
                              <span className="font-bold">DESC:</span> {getSelectedModel()?.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="persona" className="text-sm font-mono font-bold">
                        AI.PERSONA
                      </Label>
                      <Textarea
                        id="persona"
                        value={settings.persona}
                        onChange={(e) => setSettings((prev) => ({ ...prev, persona: e.target.value }))}
                        className="bg-gray-50 border-2 border-gray-300 focus:border-black font-mono resize-none"
                        rows={3}
                      />
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.header>

      {/* Chat Messages */}
      <div className="flex-1 max-w-6xl mx-auto px-6 py-8 h-[calc(100vh-140px)] overflow-y-auto">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <motion.div
                className="w-20 h-20 border-4 border-black flex items-center justify-center mb-6"
                whileHover={{ scale: 1.1, rotate: 45 }}
                transition={{ duration: 0.3 }}
              >
                <MessageSquare className="w-10 h-10" />
              </motion.div>
              <h2 className="text-3xl font-mono font-bold mb-2">NEURAL.INTERFACE.ACTIVE</h2>
              <p className="text-black/60 font-mono">AWAITING.INPUT.SEQUENCE...</p>

              {/* Matrix-style code rain effect */}
              <div className="mt-8 font-mono text-xs text-green-600/30 leading-tight">
                <motion.div
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                >
                  {"> INITIALIZING NEURAL PATHWAYS..."}
                  <br />
                  {"> QUANTUM ENCRYPTION: ENABLED"}
                  <br />
                  {"> CONSCIOUSNESS BRIDGE: ACTIVE"}
                  <br />
                  {getSelectedModel() && `> MODEL: ${getSelectedModel()?.name.toUpperCase()}`}
                  <br />
                  {getSelectedModel()?.architecture.input_modalities.includes("image") && "> VISION.MODE: ENABLED"}
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, x: message.role === "user" ? 100 : -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex items-start space-x-3 max-w-[80%] ${message.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
                  >
                    <motion.div
                      className={`w-10 h-10 border-2 flex items-center justify-center font-mono text-xs font-bold ${
                        message.role === "user"
                          ? "bg-black text-white border-black"
                          : message.status === "error"
                            ? "bg-red-500 text-white border-red-500"
                            : "bg-white text-black border-black"
                      }`}
                      whileHover={{ scale: 1.1, rotate: 45 }}
                      transition={{ duration: 0.2 }}
                    >
                      {message.role === "user" ? "USR" : "AI"}
                    </motion.div>

                    <motion.div
                      className={`px-4 py-3 border-2 font-mono text-sm relative ${
                        message.role === "user"
                          ? "bg-black text-white border-black"
                          : message.status === "error"
                            ? "bg-red-50 text-red-800 border-red-300"
                            : "bg-gray-50 text-black border-gray-300"
                      }`}
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="whitespace-pre-wrap">{renderMessageContent(message.content)}</div>

                      {/* Retry button for error messages */}
                      {message.status === "error" && message.retryData && (
                        <div className="mt-3 pt-3 border-t border-red-300">
                          <Button
                            onClick={() => retryMessage(message)}
                            size="sm"
                            className="bg-red-500 text-white hover:bg-red-600 font-mono text-xs"
                            disabled={isLoading}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            RETRY.TRANSMISSION
                          </Button>
                        </div>
                      )}

                      {/* Status indicator */}
                      {message.status === "sending" && (
                        <div className="absolute top-2 right-2">
                          <motion.div
                            className="w-2 h-2 bg-yellow-500 rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                          />
                        </div>
                      )}

                      <div
                        className={`text-xs mt-2 opacity-50 ${
                          message.role === "user"
                            ? "text-white"
                            : message.status === "error"
                              ? "text-red-600"
                              : "text-black"
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                        {message.status === "error" && " • TRANSMISSION.FAILED"}
                        {message.status === "sending" && " • TRANSMITTING..."}
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, x: -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center font-mono text-xs font-bold">
                      AI
                    </div>
                    <div className="bg-gray-50 border-2 border-gray-300 px-4 py-3">
                      <motion.div className="flex space-x-1 font-mono">
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, delay: 0 }}
                        >
                          PROCESSING
                        </motion.span>
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, delay: 0.2 }}
                        >
                          .
                        </motion.span>
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, delay: 0.4 }}
                        >
                          .
                        </motion.span>
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, delay: 0.6 }}
                        >
                          .
                        </motion.span>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 border-t-2 border-black bg-white/80 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image || "/placeholder.svg"}
                    alt={`Selected ${index + 1}`}
                    className="w-16 h-16 object-cover rounded border-2 border-gray-300 cursor-pointer hover:border-black transition-colors"
                    onClick={() => openImageViewer(image)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-500 text-white hover:bg-red-600 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={settings.apiKey ? "ENTER.NEURAL.COMMAND..." : "CONFIGURE.API.KEY.FIRST..."}
                disabled={!settings.apiKey || isLoading}
                className="bg-gray-50 border-2 border-gray-300 focus:border-black text-black placeholder-black/40 font-mono resize-none min-h-[60px] max-h-32"
                rows={1}
              />
            </div>

            {/* Image Upload Button (only show for vision models) */}
            {getSelectedModel()?.architecture.input_modalities.includes("image") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-[60px] px-3 border-2 border-gray-300 hover:border-black font-mono"
                disabled={!settings.apiKey || isLoading}
              >
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <ImageIcon className="w-5 h-5" />
                </motion.div>
              </Button>
            )}

            <Button
              onClick={sendMessage}
              disabled={!input.trim() || !settings.apiKey || !settings.model || isLoading}
              className="bg-black text-white hover:bg-gray-800 transition-all duration-300 h-[60px] px-6 font-mono border-2 border-black"
            >
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Send className="w-5 h-5" />
              </motion.div>
            </Button>
          </div>

          {(!settings.apiKey || !settings.model) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-600 text-xs font-mono mt-2 font-bold"
            >
              ERROR: {!settings.apiKey ? "API.KEY.REQUIRED" : "MODEL.SELECTION.REQUIRED"} →
              ACCESS.CONFIG.TO.AUTHENTICATE
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
