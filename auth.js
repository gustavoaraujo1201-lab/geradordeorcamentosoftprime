// auth.js — Sistema de Autenticação com Supabase

class AuthManager {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this._initialized = false;
    this.init();
  }

  async init() {
    try {
      let attempts = 0;
      while (typeof window.supabase === 'undefined' && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase não está carregado após espera');
        return;
      }

      const url = window.SUPABASE_URL;
      const key = window.SUPABASE_ANON_KEY;

      if (!url || !key) {
        console.error('❌ Credenciais não configuradas. URL:', url, 'KEY:', key ? 'OK' : 'VAZIA');
        return;
      }

      console.log('🔄 Inicializando Supabase com URL:', url);

      this.supabase = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (error) {
        console.error('❌ Erro ao verificar sessão:', error.message);
      }

      this._initialized = true;

      if (session) {
        console.log('✅ Usuário já logado:', session.user.email);
        this.currentUser = session.user;
        this.showApp();
      } else {
        console.log('ℹ️ Nenhum usuário logado');
        this.showAuth();
      }

      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔔 Auth event:', event);
        if (session) {
          this.currentUser = session.user;
          this.showApp();
        } else {
          this.currentUser = null;
          this.showAuth();
        }
      });

    } catch (error) {
      console.error('❌ Erro ao inicializar auth:', error);
    }
  }

  showAuth() {
    if (!window.location.pathname.endsWith('login.html') && window.location.pathname !== '/login.html') {
      console.log('🔐 Redirecionando para login...');
      window.location.href = 'login.html';
    }
  }

  showApp() {
    if (window.location.pathname.endsWith('login.html') || window.location.pathname === '/login.html') {
      console.log('✅ Redirecionando para o app...');
      window.location.href = 'index.html';
      return;
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl && this.currentUser) {
      this.supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', this.currentUser.id)
        .single()
        .then(({ data: profile }) => {
          const displayName = profile?.username || profile?.full_name ||
                              this.currentUser.email.split('@')[0];
          userNameEl.textContent = displayName;
        })
        .catch(() => {
          userNameEl.textContent = this.currentUser.email.split('@')[0];
        });
    }

    if (typeof renderAll === 'function') {
      console.log('🔄 Carregando dados do usuário...');
      renderAll();
    }

    console.log('✅ App carregado para:', this.currentUser?.email);
  }

  async signUp(email, password, username) {
    try {
      if (!this.supabase) {
        return { success: false, message: '❌ Sistema não inicializado. Recarregue a página.' };
      }

      // Validação mínima: apenas verifica comprimento
      if (!username || username.trim().length < 2) {
        return { success: false, message: '❌ Nome de usuário deve ter pelo menos 2 caracteres.' };
      }

      const cleanUsername = username.trim();

      // Verificar se username já existe (busca case-insensitive)
      const { data: existingUser } = await this.supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        return { success: false, message: '❌ Este nome de usuário já está em uso. Escolha outro.' };
      }

      console.log('🔄 Cadastrando usuário:', email);

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: cleanUsername },
          emailRedirectTo: null
        }
      });

      if (error) throw error;

      // Salvar username na tabela de perfis
      if (data.user) {
        const { error: profileError } = await this.supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email,
            username: cleanUsername,
            updated_at: new Date().toISOString()
          });
        if (profileError) {
          console.error('❌ Erro ao salvar perfil:', profileError.message);
        }
      }

      // Tenta fazer login automático após cadastro
      // (funciona quando confirmação de email está desativada no Supabase)
      const { error: signInError } = await this.supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        console.log('✅ Login automático após cadastro');
      }

      console.log('✅ Cadastro realizado');
      return {
        success: true,
        message: '✅ Conta criada! Você já pode fazer login.'
      };

    } catch (error) {
      console.error('❌ Erro no cadastro:', error);
      let msg = error.message || 'Erro desconhecido';
      if (msg.includes('Failed to fetch')) msg = 'Erro de conexão. Verifique sua internet.';
      if (msg.includes('User already registered')) msg = 'Este email já está cadastrado.';
      return { success: false, message: `❌ ${msg}` };
    }
  }

  async signIn(identifier, password) {
    try {
      if (!this.supabase) {
        return { success: false, message: '❌ Sistema não inicializado. Recarregue a página.' };
      }

      let email = identifier.trim();

      // Se não contém '@', trata como username e busca o email correspondente
      if (!email.includes('@')) {
        console.log('🔄 Buscando email por username:', email);

        // Busca case-insensitive pelo username
        const { data: profile, error: profileError } = await this.supabase
          .from('profiles')
          .select('email')
          .ilike('username', email)
          .maybeSingle();

        if (profileError) {
          console.error('❌ Erro ao buscar perfil:', profileError.message);
        }

        if (!profile || !profile.email) {
          return { success: false, message: '❌ Usuário não encontrado. Verifique seu email ou nome de usuário.' };
        }

        email = profile.email;
        console.log('✅ Email encontrado para o username:', email);
      }

      console.log('🔄 Fazendo login com email:', email);

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      console.log('✅ Login realizado');
      return { success: true, message: '✅ Login realizado com sucesso!' };

    } catch (error) {
      console.error('❌ Erro no login:', error);
      let msg = error.message || 'Erro desconhecido';
      if (msg.includes('Invalid login credentials')) msg = 'Email/usuário ou senha incorretos.';
      if (msg.includes('Email not confirmed')) msg = 'Confirme seu email antes de fazer login.';
      if (msg.includes('Failed to fetch')) msg = 'Erro de conexão. Verifique sua internet.';
      return { success: false, message: `❌ ${msg}` };
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      window.location.href = 'login.html';
      return { success: true, message: '✅ Você saiu com sucesso!' };
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      return { success: false, message: `❌ ${error.message}` };
    }
  }

  async resetPassword(email) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login.html`
      });
      if (error) throw error;
      return { success: true, message: '✅ Email de recuperação enviado!' };
    } catch (error) {
      console.error('❌ Erro ao recuperar senha:', error);
      return { success: false, message: `❌ ${error.message}` };
    }
  }

  getUserId() { return this.currentUser?.id || null; }
  getUserEmail() { return this.currentUser?.email || null; }
  getSupabase() { return this.supabase; }
  isAuthenticated() { return this.currentUser !== null; }
}

window.authManager = new AuthManager();
console.log('✅ AuthManager carregado');