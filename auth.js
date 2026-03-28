// auth.js — Sistema de Autenticação com Supabase (sem loop)

class AuthManager {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this._initialized = false;
    this._redirecting = false;
    this.init();
  }

  async init() {
    try {
      // Aguarda Supabase SDK carregar
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
        console.error('❌ Credenciais não configuradas.');
        return;
      }

      this.supabase = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false   // IMPORTANTE: evita loop com hash de URL
        }
      });

      // Verifica sessão UMA única vez no init
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) console.error('❌ Erro ao verificar sessão:', error.message);

      this._initialized = true;

      const isLoginPage = this._isLoginPage();
      const isAppPage   = this._isAppPage();

      if (session) {
        this.currentUser = session.user;
        console.log('✅ Sessão ativa:', this.currentUser.email);

        if (isLoginPage && !this._redirecting) {
          // Usuário já logado tentando acessar login → vai para o app
          this._redirecting = true;
          window.location.replace('/index');
          return;
        }

        if (isAppPage) {
          // Já está no app → atualiza UI
          this._updateAppUI();
        }
      } else {
        console.log('ℹ️ Sem sessão ativa');

        if (isAppPage && !this._redirecting) {
          // Sem sessão no app → volta para login
          this._redirecting = true;
          window.location.replace('/login');
          return;
        }
        // Se já está no login sem sessão → não faz nada
      }

      // Listener APENAS para SIGNED_OUT
      // NÃO reagimos a SIGNED_IN aqui para evitar loops
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔔 Auth event:', event);

        if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          if (!this._redirecting) {
            this._redirecting = true;
            window.location.replace('/login');
          }
        }

        // TOKEN_REFRESHED: apenas atualiza o usuário local, sem redirecionar
        if (event === 'TOKEN_REFRESHED' && session) {
          this.currentUser = session.user;
        }
      });

    } catch (error) {
      console.error('❌ Erro ao inicializar auth:', error);
    }
  }

  // ── Helpers de rota ────────────────────────────────────────────────────────

  _isLoginPage() {
    const p = window.location.pathname;
    return p.endsWith('login.html') || p === '/login' || p === '/login/' || p === '/';
  }

  _isAppPage() {
    const p = window.location.pathname;
    return p.endsWith('index.html') || p === '/index' || p === '/index/';
  }

  // ── Atualiza UI do app (nome do usuário, remove guard) ────────────────────

  _updateAppUI() {
    const userNameEl = document.getElementById('userName');
    if (userNameEl && this.currentUser) {
      this.supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', this.currentUser.id)
        .single()
        .then(({ data: profile }) => {
          userNameEl.textContent =
            profile?.username ||
            profile?.full_name ||
            this.currentUser.user_metadata?.username ||
            this.currentUser.user_metadata?.full_name ||
            this.currentUser.email.split('@')[0];
        })
        .catch(() => {
          userNameEl.textContent =
            this.currentUser.user_metadata?.username ||
            this.currentUser.user_metadata?.full_name ||
            this.currentUser.email.split('@')[0];
        });
    }

    const guard = document.getElementById('auth-guard');
    if (guard) guard.remove();
    if (typeof renderAll === 'function') renderAll();
  }

  // Mantido para compatibilidade com código legado
  showApp() { this._updateAppUI(); }

  // ── Sign Up ────────────────────────────────────────────────────────────────

  async signUp(email, password, username) {
    try {
      if (!this.supabase)
        return { success: false, message: '❌ Sistema não inicializado. Recarregue a página.' };

      if (!username || username.trim().length < 2)
        return { success: false, message: '❌ Nome de usuário deve ter pelo menos 2 caracteres.' };

      const cleanUsername = username.trim();

      // Verifica se username já existe
      const { data: existingUser } = await this.supabase
        .from('profiles').select('id').ilike('username', cleanUsername).maybeSingle();

      if (existingUser)
        return { success: false, message: '❌ Este nome de usuário já está em uso. Escolha outro.' };

      // Cadastra salvando username no metadata
      const { data, error } = await this.supabase.auth.signUp({
        email, password,
        options: {
          data: { username: cleanUsername, full_name: cleanUsername, display_name: cleanUsername }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('Usuário não foi criado. Tente novamente.');

      console.log('✅ Usuário criado no Auth:', data.user.id);

      // Tenta login automático (funciona se "Confirm email" estiver DESATIVADO)
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({ email, password });

      if (!signInError && signInData?.session) {
        console.log('✅ Login automático após cadastro');
        const uid = signInData.session.user.id;

        try {
          await this.supabase
            .from('profiles')
            .upsert({
              id: uid,
              email,
              username: cleanUsername,
              full_name: cleanUsername,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          console.log('✅ Profile salvo com sucesso');
        } catch (e) {
          console.warn('⚠️ Exceção ao salvar profile:', e.message);
        }

        // Redireciona para o app APÓS salvar tudo
        this._redirecting = true;
        window.location.replace('/index');
        return { success: true, autoLogin: true, message: '✅ Conta criada e login realizado!' };
      }

      return { success: true, autoLogin: false, message: '✅ Conta criada! Faça login agora.' };

    } catch (error) {
      console.error('❌ Erro no cadastro:', error);
      let msg = error.message || 'Erro desconhecido';
      if (msg.includes('Failed to fetch'))         msg = 'Erro de conexão. Verifique sua internet.';
      if (msg.includes('User already registered')) msg = 'Este email já está cadastrado.';
      if (msg.includes('Password should be at least')) msg = 'A senha deve ter pelo menos 6 caracteres.';
      return { success: false, message: `❌ ${msg}` };
    }
  }

  // ── Sign In ────────────────────────────────────────────────────────────────

  async signIn(identifier, password) {
    try {
      if (!this.supabase)
        return { success: false, message: '❌ Sistema não inicializado. Recarregue a página.' };

      let email = identifier.trim();

      // Login por username
      if (!email.includes('@')) {
        console.log('🔄 Buscando email por username:', email);
        const { data: profile, error: profileError } = await this.supabase
          .from('profiles').select('email').ilike('username', email).maybeSingle();

        if (profileError) console.error('❌ Erro ao buscar perfil:', profileError.message);
        if (!profile?.email)
          return { success: false, message: '❌ Usuário não encontrado. Verifique seu email ou nome de usuário.' };

        email = profile.email;
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      console.log('✅ Login realizado');
      this.currentUser = data.user;

      // Redireciona para o app
      this._redirecting = true;
      window.location.replace('/index');
      return { success: true, message: '✅ Login realizado com sucesso!' };

    } catch (error) {
      console.error('❌ Erro no login:', error);
      let msg = error.message || 'Erro desconhecido';
      if (msg.includes('Invalid login credentials')) msg = 'Email/usuário ou senha incorretos.';
      if (msg.includes('Email not confirmed'))       msg = 'Confirme seu email antes de fazer login.';
      if (msg.includes('Failed to fetch'))           msg = 'Erro de conexão. Verifique sua internet.';
      return { success: false, message: `❌ ${msg}` };
    }
  }

  // ── Sign Out ───────────────────────────────────────────────────────────────

  async signOut() {
    try {
      if (!this.supabase) return { success: false, message: '❌ Sistema não inicializado.' };
      await this.supabase.auth.signOut();
      // O listener SIGNED_OUT já cuida do redirecionamento
      return { success: true };
    } catch (error) {
      return { success: false, message: `❌ ${error.message}` };
    }
  }

  // ── Reset Password ─────────────────────────────────────────────────────────

  async resetPassword(email) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login.html`
      });
      if (error) throw error;
      return { success: true, message: '✅ Email de recuperação enviado!' };
    } catch (error) {
      return { success: false, message: `❌ ${error.message}` };
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getUserId()      { return this.currentUser?.id    || null; }
  getUserEmail()   { return this.currentUser?.email || null; }
  getSupabase()    { return this.supabase; }
  isAuthenticated(){ return this.currentUser !== null; }
}

window.authManager = new AuthManager();
console.log('✅ AuthManager carregado');