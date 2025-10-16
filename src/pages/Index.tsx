import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  
  const [apiKey, setApiKey] = useState('GkzSKt3IGn02tS5qFOi1qS51vfgw2zOE');
  const [userName, setUserName] = useState('Пользователь');
  const [systemPrompt, setSystemPrompt] = useState('Ты полезный ИИ-ассистент.');

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    setCurrentSession({ ...currentSession, messages: updatedMessages });
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = await response.json();
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, aiMessage];
      const updatedSession = { ...currentSession, messages: finalMessages };
      setCurrentSession(updatedSession);
      
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    } catch (error) {
      console.error('Error:', error);
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

              <Button onClick={createNewChat} className="gap-2">
                <Icon name="Plus" size={18} />
                Новый чат
              </Button>
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
                            <p className="whitespace-pre-wrap">{message.content}</p>
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
                  <div className="max-w-3xl mx-auto flex gap-2">
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
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className="h-[60px] w-[60px] rounded-full"
                    >
                      <Icon name="Send" size={20} />
                    </Button>
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
