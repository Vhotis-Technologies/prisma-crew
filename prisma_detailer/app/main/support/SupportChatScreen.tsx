/**
 * Direct chat with support using react-native-gifted-chat + websockets.
 * 
 * Crew members can message support in real-time, optionally mentioning a booking
 * reference. Both crew and support can close the chat when resolved.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GiftedChat, IMessage, Send, Bubble, InputToolbar } from "react-native-gifted-chat";
import Constants from "expo-constants";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { Screen, CrewText } from "@/app/components/ui/system";
import { useAppSelector } from "@/app/store/my_store";

export default function SupportChatScreen() {
  const { colors, spacing, radius } = useThemeTokens();
  const accessToken = useAppSelector((s: any) => s.auth.access);
  const userProfile = useAppSelector((s: any) => s.auth.user);
  
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [threadStatus, setThreadStatus] = useState<"open" | "closed">("open");
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const wsUrl = Constants.expoConfig?.extra?.websockets_url;
  const apiUrl = Constants.expoConfig?.extra?.detailer_app_url;

  const appendUniqueMessages = useCallback((incoming: IMessage[]) => {
    setMessages((prev) => {
      const byId = new Map<string, IMessage>();
      for (const msg of prev) {
        byId.set(String(msg._id), msg);
      }
      for (const msg of incoming) {
        byId.set(String(msg._id), msg);
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);
  
  // Decode JWT to check if token is valid (not expired)
  const isTokenValid = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      // Check if token expires in more than 30 seconds
      return expiryTime > (now + 30000);
    } catch (error) {
      console.error("Failed to decode token:", error);
      return false;
    }
  }, []);
  
  // Only connect when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Reset mounted state
      mountedRef.current = true;
      
      if (!accessToken || !wsUrl || !apiUrl) {
        setIsLoading(false);
        return;
      }
      
      // Check if token is valid before connecting
      if (!isTokenValid(accessToken)) {
        console.warn("Token is expired or invalid. Please log in again.");
        setIsLoading(false);
        return;
      }
      
      // Load message history via REST first
      loadMessageHistory();
      
      // Connect websocket only when screen is focused
      connectWebSocket();
      
      return () => {
        // Cleanup: close WebSocket when leaving screen
        mountedRef.current = false;
        clearReconnectTimer();
        if (wsRef.current) {
          console.log("Closing WebSocket - screen unfocused");
          wsRef.current.close();
          wsRef.current = null;
        }
        setIsConnected(false);
      };
    }, [accessToken, wsUrl, apiUrl, isTokenValid, clearReconnectTimer])
  );
  
  const loadMessageHistory = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/support-chat/get_my_thread/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      
      if (data.data?.thread) {
        setThreadStatus(data.data.thread.status);
        
        if (data.data.thread.messages) {
          const history: IMessage[] = data.data.thread.messages.map((m: any) => ({
            _id: m._id,
            text: m.text,
            createdAt: new Date(m.createdAt),
            user: {
              _id: m.user._id,
              name: m.user.name,
            },
          }));
          const uniqueById = new Map<string, IMessage>();
          history.forEach((msg) => uniqueById.set(String(msg._id), msg));
          setMessages(
            Array.from(uniqueById.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load message history:", error);
      setIsLoading(false);
    }
  };
  
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      return;
    }
    clearReconnectTimer();

    // Double-check token is still valid before connecting
    if (!isTokenValid(accessToken)) {
      console.warn("Cannot connect: token is expired");
      setIsLoading(false);
      return;
    }
    
    console.log("Connecting to support chat WebSocket...");
    const ws = new WebSocket(`${wsUrl}?token=${accessToken}`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log("Support chat connected");
      if (mountedRef.current) {
        setIsConnected(true);
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "thread_status") {
          if (mountedRef.current) {
            setThreadStatus(data.status === "closed" ? "closed" : "open");
          }
          return;
        }

        if (!data._id || !data.text) {
          return;
        }
        
        // Convert to Gifted Chat format
        const newMessage: IMessage = {
          _id: data._id,
          text: data.text,
          createdAt: new Date(data.createdAt),
          user: {
            _id: data.user._id,
            name: data.user.name,
          },
        };

        const role = data?.user?.role as string | undefined;
        if (role === "system") {
          const lower = String(data?.text || "").toLowerCase();
          if (lower.includes("chat closed")) {
            setThreadStatus("closed");
          } else if (lower.includes("chat reopened")) {
            setThreadStatus("open");
          }
        }
        
        if (mountedRef.current) {
          appendUniqueMessages([newMessage]);
        }
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (mountedRef.current) {
        setIsConnected(false);
      }
    };
    
    ws.onclose = (event) => {
      console.log("Support chat disconnected", event.code, event.reason);
      if (mountedRef.current) {
        setIsConnected(false);
      }
      
      // Only attempt to reconnect if:
      // 1. Component is still mounted (user is still on the screen)
      // 2. Token is still valid
      // 3. Disconnect wasn't intentional (code 1000 = normal closure)
      if (mountedRef.current && isTokenValid(accessToken) && event.code !== 1000) {
        console.log("Attempting to reconnect in 3 seconds...");
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current && wsUrl && isTokenValid(accessToken)) {
            connectWebSocket();
          }
        }, 3000);
      }
    };
  };
  
  const onSend = useCallback((newMessages: IMessage[] = []) => {
    if (!wsRef.current || !isConnected) {
      console.warn("WebSocket not connected");
      return;
    }
    if (threadStatus === "closed") {
      console.warn("Chat is closed");
      return;
    }
    
    const message = newMessages[0];
    
    // Send via WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'message',
      body: message.text,
    }));
    
    // Message is echoed back through websocket after server save.
  }, [isConnected, threadStatus]);
  
  const handleCloseChat = async () => {
    if (!apiUrl || !accessToken) return;
    
    try {
      await fetch(`${apiUrl}/api/v1/support-chat/close_thread/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      setThreadStatus("closed");
      
      // Add system message
      const systemMessage: IMessage = {
        _id: Math.random().toString(),
        text: "Chat closed. You can reopen by sending a new message.",
        createdAt: new Date(),
        user: {
          _id: '0',
          name: 'System',
        },
        system: true,
      };
      setMessages((prev) => GiftedChat.append(prev, [systemMessage]));
    } catch (error) {
      console.error("Failed to close chat:", error);
    }
  };
  
  if (isLoading) {
    return (
      <Screen padded edges={["top"]}>
        <View style={[styles.header, { gap: spacing.sm, padding: spacing.md }]}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <CrewText variant="title">Support Chat</CrewText>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <CrewText variant="body" muted style={{ marginTop: spacing.md }}>
            Loading chat...
          </CrewText>
        </View>
      </Screen>
    );
  }
  
  return (
    <Screen padded={false} edges={["top"]}>
      <View 
        style={[
          styles.header, 
          { 
            gap: spacing.sm, 
            padding: spacing.md, 
            backgroundColor: colors.cards, 
            borderBottomWidth: 1, 
            borderBottomColor: colors.borders 
          }
        ]}
      >
        <Pressable 
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        
        <View style={styles.headerTitle}>
          <CrewText variant="title">Support Chat</CrewText>
          {threadStatus === "closed" && (
            <CrewText variant="caption" muted>
              Closed
            </CrewText>
          )}
        </View>
        
        <View style={styles.headerActions}>
          {isConnected ? (
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: colors.success }
              ]}
              accessibilityLabel="Connected"
            />
          ) : (
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: colors.muted }
              ]}
              accessibilityLabel="Connecting..."
            />
          )}
          
          {threadStatus === "open" && (
            <Pressable
              onPress={handleCloseChat}
              style={({ pressed }) => [
                {
                  padding: spacing.xs,
                  opacity: pressed ? 0.7 : 1,
                }
              ]}
              accessibilityLabel="Close chat"
            >
              <Ionicons name="close-circle-outline" size={24} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 12}
      >
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{
            _id: userProfile?.id || '0',
            name: userProfile?.first_name || 'You',
          }}
          renderBubble={(props) => (
            <Bubble
              {...props}
              wrapperStyle={{
                left: {
                  backgroundColor: colors.cards,
                  borderRadius: radius.md,
                  padding: spacing.xs,
                },
                right: {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  padding: spacing.xs,
                },
              }}
              textStyle={{
                left: {
                  color: colors.text,
                },
                right: {
                  color: colors.buttonText,
                },
              }}
            />
          )}
          renderInputToolbar={(props) => (
            <InputToolbar
              {...props}
              containerStyle={{
                backgroundColor: colors.background,
                borderTopColor: colors.borders,
                borderTopWidth: 1,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
              primaryStyle={{
                alignItems: 'center',
              }}
            />
          )}
          textInputProps={{
            placeholder: threadStatus === "closed" ? "Chat is closed" : "Type a message...",
            placeholderTextColor: colors.text,
            editable: threadStatus !== "closed",
          }}
          messagesContainerStyle={{
            backgroundColor: colors.background,
          }}
          renderSend={(props) =>
            threadStatus === "closed" ? null : (
              <Send {...props}>
                <View 
                  style={[
                    styles.sendButton,
                    { marginRight: spacing.xs, marginBottom: spacing.xs }
                  ]}
                >
                  <Ionicons name="send" size={24} color={colors.primary} />
                </View>
              </Send>
            )
          }
          renderAvatar={null}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    gap: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    justifyContent: "center",
    alignItems: "center",
  },
});
