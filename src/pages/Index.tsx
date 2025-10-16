import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Icon from '@/components/ui/icon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  image?: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

interface Prompt {
  id: string;
  title: string;
  content: string;
}

const Index = () => {
  const [currentSession, setCurrentSession] = useState<ChatSession>({
    id: '1',
    title: 'Новый чат',
    messages: [],
    createdAt: new Date(),
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>([currentSession]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'prompts' | 'profile' | 'api'>('chat');
  
  const [prompts, setPrompts] = useState<Prompt[]>([
    { id: '1', title: 'Помощник по коду', content: 'Ты опытный программист. Помоги мне с кодом.' },
    { id: '2', title: 'Креативный писатель', content: 'Ты креативный писатель. Помоги создать интересный текст.' },
  ]);
  
  const [apiKey, setApiKey] = useState('');
  const [userName, setUserName] = useState('Пользователь');
  const [systemPrompt, setSystemPrompt] = useState('Ты полезный ИИ-ассистент.');
  const [thinkingMode, setThinkingMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState('mistral-small-latest');
  const [visionModel, setVisionModel] = useState('pixtral-12b-2409');
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !uploadedImage) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input || 'Что на изображении?',
      image: uploadedImage || undefined,
      timestamp: new Date(),
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    setCurrentSession({ ...currentSession, messages: updatedMessages });
    setInput('');
    setUploadedImage(null);
    setIsLoading(true);

    // Check if the last message has an image
    const hasImage = !!userMessage.image;
    // Use vision model when image is present
    const modelToUse = hasImage ? visionModel : selectedModel;
    const useThinking = thinkingMode;

    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      thinking: useThinking ? '' : undefined,
      timestamp: new Date(),
    };

    const messagesWithAI = [...updatedMessages, aiMessage];
    setCurrentSession({ ...currentSession, messages: messagesWithAI });

    // Format messages for API
    const formatMessagesForAPI = (messages: Message[]) => {
      return messages.map(m => {
        if (m.image) {
          // Vision API format with image
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: m.image }
            ]
          };
        } else {
          // Regular text format
          return { role: m.role, content: m.content };
        }
      });
    };

    try {
      if (useThinking) {
        const thinkingResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            stream: true,
            safe_prompt: false,
            messages: [
              { role: 'system', content: `Ты MistralThink - режим глубокого анализа. Рассуждай вслух подробно и структурированно:

1. **Анализ запроса**: Что именно спрашивает пользователь? Какие ключевые слова? Какой контекст?
2. **Проверка предположений**: Какие допущения можно сделать? Что может быть неоднозначным?
3. **Варианты решения**: Перечисли все возможные подходы. Плюсы и минусы каждого.
4. **Проверка на ошибки**: Какие подводные камни? Что может пойти не так?
5. **Логическая цепочка**: Пошаговое рассуждение от проблемы к решению.
6. **Выбор лучшего подхода**: Почему этот вариант оптимальный?
7. **План ответа**: Как структурировать ответ для максимальной ясности?

Будь максимально детальным. Проверяй каждый шаг на логичность и корректность.` },
              ...formatMessagesForAPI(updatedMessages),
            ],
          }),
        });

        if (!thinkingResponse.body) throw new Error('No response body');

        const thinkingReader = thinkingResponse.body.getReader();
        const thinkingDecoder = new TextDecoder();
        let accumulatedThinking = '';

        while (true) {
          const { done, value } = await thinkingReader.read();
          if (done) break;

          const chunk = thinkingDecoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                
                if (content) {
                  accumulatedThinking += content;
                  
                  setCurrentSession(prev => ({
                    ...prev,
                    messages: prev.messages.map(m =>
                      m.id === aiMessageId ? { ...m, thinking: accumulatedThinking } : m
                    ),
                  }));
                }
              } catch (e) {
                continue;
              }
            }
          }
        }

        const finalResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            stream: true,
            safe_prompt: false,
            messages: [
              { role: 'system', content: systemPrompt },
              ...formatMessagesForAPI(updatedMessages),
              { role: 'assistant', content: `Мои размышления: ${accumulatedThinking}` },
              { role: 'user', content: 'Теперь дай краткий и понятный ответ на основе своих размышлений.' },
            ],
          }),
        });

        if (!finalResponse.body) throw new Error('No response body');

        const finalReader = finalResponse.body.getReader();
        const finalDecoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await finalReader.read();
          if (done) break;

          const chunk = finalDecoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                
                if (content) {
                  accumulatedContent += content;
                  
                  setCurrentSession(prev => ({
                    ...prev,
                    messages: prev.messages.map(m =>
                      m.id === aiMessageId ? { ...m, content: accumulatedContent } : m
                    ),
                  }));
                }
              } catch (e) {
                continue;
              }
            }
          }
        }

        setSessions(prev => prev.map(s => 
          s.id === currentSession.id 
            ? { ...s, messages: messagesWithAI.map(m => m.id === aiMessageId ? { ...m, content: accumulatedContent, thinking: accumulatedThinking } : m) } 
            : s
        ));
      } else {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            stream: true,
            safe_prompt: false,
            messages: [
              { role: 'system', content: systemPrompt },
              ...formatMessagesForAPI(updatedMessages),
            ],
          }),
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                
                if (content) {
                  accumulatedContent += content;
                  
                  setCurrentSession(prev => ({
                    ...prev,
                    messages: prev.messages.map(m =>
                      m.id === aiMessageId ? { ...m, content: accumulatedContent } : m
                    ),
                  }));
                }
              } catch (e) {
                continue;
              }
            }
          }
        }

        setSessions(prev => prev.map(s => 
          s.id === currentSession.id 
            ? { ...s, messages: messagesWithAI.map(m => m.id === aiMessageId ? { ...m, content: accumulatedContent } : m) } 
            : s
        ));
      }
    } catch (error) {
      console.error('Error:', error);
      setCurrentSession(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== aiMessageId),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Новый чат',
      messages: [],
      createdAt: new Date(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSession(newSession);
    setActiveTab('chat');
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSession(session);
    setActiveTab('chat');
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSession.id === id) {
      createNewChat();
    }
  };

  const addPrompt = () => {
    const newPrompt: Prompt = {
      id: Date.now().toString(),
      title: 'Новый промпт',
      content: '',
    };
    setPrompts([...prompts, newPrompt]);
  };

  const updatePrompt = (id: string, field: 'title' | 'content', value: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deletePrompt = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  const usePrompt = (content: string) => {
    setInput(content);
    setActiveTab('chat');
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d1b4e] flex">
      <Sheet>
        <div className="flex-1 flex flex-col">
          <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Icon name="Menu" size={24} />
                  </Button>
                </SheetTrigger>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  MISTRAL AI CHAT
                </h1>
              </div>
              
              <div className="hidden lg:flex gap-2">
                {[
                  { key: 'chat', icon: 'MessageSquare', label: 'Чат' },
                  { key: 'history', icon: 'Clock', label: 'История' },
                  { key: 'prompts', icon: 'FileText', label: 'Промпты' },
                  { key: 'profile', icon: 'User', label: 'Профиль' },
                  { key: 'api', icon: 'Key', label: 'API Key' },
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    variant={activeTab === tab.key ? 'default' : 'ghost'}
                    onClick={() => setActiveTab(tab.key as any)}
                    className="gap-2"
                  >
                    <Icon name={tab.icon as any} size={18} />
                    {tab.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                {currentSession.messages.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      const chatText = currentSession.messages
                        .map(m => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`)
                        .join('\n\n');
                      const blob = new Blob([chatText], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `chat-${new Date().toISOString()}.txt`;
                      a.click();
                    }}
                  >
                    <Icon name="Download" size={18} />
                  </Button>
                )}
                <Button onClick={createNewChat} className="gap-2">
                  <Icon name="Plus" size={18} />
                  Новый чат
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                <ScrollArea className="flex-1 px-4">
                  {currentSession.messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center max-w-md animate-fade-in">
                        <h2 className="text-3xl font-bold mb-4">Чем я могу помочь?</h2>
                        <p className="text-muted-foreground">
                          Начните новый диалог с ИИ-ассистентом
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 space-y-4 max-w-3xl mx-auto">
                      {currentSession.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 animate-fade-in ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'message-user text-white'
                                : 'message-ai'
                            }`}
                          >
                            {message.thinking && (
                              <Collapsible
                                open={expandedThinking[message.id]}
                                onOpenChange={(open) =>
                                  setExpandedThinking(prev => ({ ...prev, [message.id]: open }))
                                }
                                className="mb-3"
                              >
                                <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
                                  <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:opacity-80">
                                    <span className="text-sm font-medium text-primary flex items-center gap-2">
                                      <Icon name="Brain" size={16} />
                                      Думаю...
                                    </span>
                                    <Icon 
                                      name={expandedThinking[message.id] ? "ChevronUp" : "ChevronDown"} 
                                      size={16} 
                                      className="text-primary"
                                    />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-2">
                                    <div className="text-sm text-muted-foreground prose prose-invert prose-sm max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {message.thinking}
                                      </ReactMarkdown>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            )}
                            {message.image && (
                              <div className="mb-3">
                                <img 
                                  src={message.image} 
                                  alt="Uploaded" 
                                  className="max-w-sm rounded-lg border border-border"
                                />
                              </div>
                            )}
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(message.content);
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                <Icon name="Copy" size={14} />
                              </Button>
                            </div>
                            <span className="text-xs opacity-70 mt-2 block">
                              {message.timestamp.toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-3 animate-fade-in">
                          <div className="message-ai rounded-2xl px-4 py-3">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <div className="border-t border-border/50 p-4 backdrop-blur-sm bg-background/80">
                  <div className="max-w-3xl mx-auto space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="thinking-toggle"
                          checked={thinkingMode}
                          onCheckedChange={setThinkingMode}
                        />
                        <Label htmlFor="thinking-toggle" className="cursor-pointer flex items-center gap-2 text-sm">
                          <Icon name="Brain" size={16} className="text-primary" />
                          <span className="font-medium">MistralThink</span>
                        </Label>
                      </div>
                      {thinkingMode && (
                        <span className="text-xs text-muted-foreground animate-fade-in">
                          Режим глубоких размышлений
                        </span>
                      )}
                    </div>
                    {uploadedImage && (
                      <div className="relative inline-block animate-fade-in">
                        <img 
                          src={uploadedImage} 
                          alt="Preview" 
                          className="max-h-32 rounded-lg border border-border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={() => setUploadedImage(null)}
                        >
                          <Icon name="X" size={14} />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-[60px] w-[60px] rounded-full"
                      onClick={() => document.getElementById('image-upload')?.click()}
                    >
                      <Icon name="Image" size={20} />
                    </Button>
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Напишите сообщение..."
                      className="min-h-[60px] resize-none"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={(!input.trim() && !uploadedImage) || isLoading}
                      size="icon"
                      className="h-[60px] w-[60px] rounded-full"
                    >
                      <Icon name="Send" size={20} />
                    </Button>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <ScrollArea className="h-full p-6">
                <div className="max-w-3xl mx-auto space-y-3">
                  <h2 className="text-2xl font-bold mb-6">История чатов</h2>
                  {sessions.map((session) => (
                    <Card
                      key={session.id}
                      className="p-4 hover:bg-accent/50 transition-colors cursor-pointer group"
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{session.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {session.messages.length} сообщений
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {session.createdAt.toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <Icon name="Trash2" size={18} />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {activeTab === 'prompts' && (
              <ScrollArea className="h-full p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Промпты</h2>
                    <Button onClick={addPrompt} className="gap-2">
                      <Icon name="Plus" size={18} />
                      Добавить
                    </Button>
                  </div>
                  
                  {prompts.map((prompt) => (
                    <Card key={prompt.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Input
                          value={prompt.title}
                          onChange={(e) => updatePrompt(prompt.id, 'title', e.target.value)}
                          className="font-semibold"
                          placeholder="Название промпта"
                        />
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => usePrompt(prompt.content)}
                          >
                            <Icon name="ArrowRight" size={18} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePrompt(prompt.id)}
                          >
                            <Icon name="Trash2" size={18} />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={prompt.content}
                        onChange={(e) => updatePrompt(prompt.id, 'content', e.target.value)}
                        placeholder="Текст промпта"
                        className="min-h-[100px]"
                      />
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {activeTab === 'profile' && (
              <ScrollArea className="h-full p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Профиль</h2>
                  
                  <Card className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="userName">Имя пользователя</Label>
                      <Input
                        id="userName"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Ваше имя"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model">Текстовая модель</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger id="model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mistral-small-latest">Mistral Small</SelectItem>
                          <SelectItem value="mistral-medium-latest">Mistral Medium</SelectItem>
                          <SelectItem value="mistral-large-latest">Mistral Large</SelectItem>
                          <SelectItem value="open-mistral-7b">Open Mistral 7B</SelectItem>
                          <SelectItem value="open-mixtral-8x7b">Open Mixtral 8x7B</SelectItem>
                          <SelectItem value="open-mixtral-8x22b">Open Mixtral 8x22B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="visionModel">Модель для изображений</Label>
                      <Select value={visionModel} onValueChange={setVisionModel}>
                        <SelectTrigger id="visionModel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pixtral-12b-2409">Pixtral 12B</SelectItem>
                          <SelectItem value="pixtral-large-latest">Pixtral Large</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Используется автоматически при загрузке изображений
                      </p>
                    </div>

                    <div className="flex items-center justify-between space-x-2 pt-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="thinking-mode" className="text-base">
                          Режим размышлений
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          ИИ сначала обдумает ответ, потом даст его
                        </p>
                      </div>
                      <Switch
                        id="thinking-mode"
                        checked={thinkingMode}
                        onCheckedChange={setThinkingMode}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="systemPrompt">Системный промпт</Label>
                      <Textarea
                        id="systemPrompt"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Опишите поведение ассистента"
                        className="min-h-[120px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Этот промпт будет использоваться во всех новых диалогах
                      </p>
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            )}

            {activeTab === 'api' && (
              <ScrollArea className="h-full p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  <h2 className="text-2xl font-bold mb-6">API ключ</h2>
                  
                  <Card className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">Mistral AI API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Введите ваш API ключ"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ваш API ключ хранится локально в браузере
                      </p>
                    </div>
                    
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Получить API ключ можно на{' '}
                        <a
                          href="https://console.mistral.ai/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          console.mistral.ai
                        </a>
                      </p>
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <SheetContent side="left" className="w-[300px] p-0">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Меню</h2>
          </div>
          <div className="p-2 space-y-1">
            {[
              { key: 'chat', icon: 'MessageSquare', label: 'Чат' },
              { key: 'history', icon: 'Clock', label: 'История' },
              { key: 'prompts', icon: 'FileText', label: 'Промпты' },
              { key: 'profile', icon: 'User', label: 'Профиль' },
              { key: 'api', icon: 'Key', label: 'API Key' },
            ].map((tab) => (
              <SheetTrigger asChild key={tab.key}>
                <Button
                  variant={activeTab === tab.key ? 'default' : 'ghost'}
                  onClick={() => setActiveTab(tab.key as any)}
                  className="w-full justify-start gap-2"
                >
                  <Icon name={tab.icon as any} size={18} />
                  {tab.label}
                </Button>
              </SheetTrigger>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Index;