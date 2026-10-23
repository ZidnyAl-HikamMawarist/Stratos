import { StratosLocale } from '../../../shared/types';

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    version: string;
    ready: string;
    active: string;
    notConfigured: string;
    plannedMilestone: string;
    docs: string;
    save: string;
    cancel: string;
    delete: string;
    test: string;
    loading: string;
  };
  nav: {
    launcher: string;
    workspace: string;
    router: string;
    settings: string;
  };
  header: {
    themeDark: string;
    themeLight: string;
    localeId: string;
    localeEn: string;
    securityBadge: string;
  };
  launcher: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    ideCardTitle: string;
    ideCardDesc: string;
    terminalCardTitle: string;
    terminalCardDesc: string;
    providerSectionTitle: string;
    noProviderTitle: string;
    noProviderDesc: string;
    noProviderHonestNote: string;
    recentWorkspacesTitle: string;
    noRecentWorkspaces: string;
    actions: {
      openFolder: string;
      configureRouter: string;
      viewDocs: string;
    };
  };
  router: {
    title: string;
    subtitle: string;
    serviceStatus: string;
    serviceRunning: string;
    serviceStopped: string;
    startService: string;
    stopService: string;
    tabs: {
      overview: string;
      providers: string;
      combos: string;
      logs: string;
      pricing: string;
    };
    metrics: {
      totalRequests: string;
      inputTokens: string;
      outputTokens: string;
      actualCost: string;
      referenceValue: string;
      successRate: string;
    };
    providers: {
      title: string;
      addProvider: string;
      providerType: string;
      accountName: string;
      apiKey: string;
      statusConnected: string;
      statusDisconnected: string;
      testSuccess: string;
      testFailed: string;
      noProviders: string;
      noProvidersDesc: string;
      maskNotice: string;
    };
    combos: {
      title: string;
      addCombo: string;
      noCombos: string;
      defaultBadge: string;
      maxAttempts: string;
      cooldown: string;
      candidates: string;
    };
    logs: {
      title: string;
      clearLogs: string;
      confirmClear: string;
      noLogs: string;
      correlationId: string;
      timestamp: string;
      model: string;
      status: string;
      duration: string;
      tokens: string;
    };
    pricing: {
      title: string;
      subtitle: string;
      model: string;
      inputCost: string;
      outputCost: string;
      source: string;
      effectiveDate: string;
      note: string;
    };
  };
  settings: {
    title: string;
    subtitle: string;
    appearanceSection: string;
    themeLabel: string;
    themeObsidianDesc: string;
    themeNordicDesc: string;
    languageSection: string;
    languageLabel: string;
    securitySection: string;
    securitySubtitle: string;
    contextIsolationLabel: string;
    nodeIntegrationLabel: string;
    sandboxLabel: string;
    electronVersionLabel: string;
    chromeVersionLabel: string;
    nodeVersionLabel: string;
    platformLabel: string;
  };
  placeholders: {
    workspaceNoticeTitle: string;
    workspaceNoticeDesc: string;
    routerNoticeTitle: string;
    routerNoticeDesc: string;
    backToLauncher: string;
  };
}

export const translations: Record<StratosLocale, Translations> = {
  'id-ID': {
    common: {
      appName: 'Stratos',
      tagline: 'Local-first AI Router & Dual-mode Coding Workspace',
      version: 'Versi',
      ready: 'Siap',
      active: 'Aktif',
      notConfigured: 'Belum Dikonfigurasi',
      plannedMilestone: 'Tersedia di Milestone',
      docs: 'Dokumentasi',
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Hapus',
      test: 'Uji Koneksi',
      loading: 'Memuat...',
    },
    nav: {
      launcher: 'Beranda',
      workspace: 'Ruang Kerja IDE',
      router: 'Router AI',
      settings: 'Pengaturan',
    },
    header: {
      themeDark: 'Obsidian Slate',
      themeLight: 'Soft Nordic Ice',
      localeId: 'Bahasa Indonesia',
      localeEn: 'English',
      securityBadge: 'Sandbox Terisolasi',
    },
    launcher: {
      welcomeTitle: 'Selamat Datang di Stratos',
      welcomeSubtitle: 'Router AI lokal dan ruang kerja pemrograman desktop yang aman, transparan, dan zero-mock.',
      ideCardTitle: 'Mode Coding IDE',
      ideCardDesc: 'Workspace profesional dengan penjelajah berkas rekursif, editor bernomor baris, peninjau diff, dan agen coding.',
      terminalCardTitle: 'Mode Coding Terminal',
      terminalCardDesc: 'Workspace terpusat pada alur terminal interaktif dengan eksekusi perintah Windows PowerShell terkontrol.',
      providerSectionTitle: 'Status Koneksi AI',
      noProviderTitle: 'Belum Ada Provider Terhubung',
      noProviderDesc: 'Stratos beroperasi secara lokal. Hubungkan API key provider Anda untuk mulai merutekan model.',
      noProviderHonestNote: 'Sesuai PRD: Hubungkan API key OpenRouter pada menu Router AI untuk mengaktifkan agen coding.',
      recentWorkspacesTitle: 'Workspace Terakhir',
      noRecentWorkspaces: 'Belum ada folder proyek yang dibuka.',
      actions: {
        openFolder: 'Buka Folder Kerja',
        configureRouter: 'Buka Pengaturan Router',
        viewDocs: 'Buka Dokumen PRD',
      },
    },
    router: {
      title: 'Dashboard Router & Provider AI',
      subtitle: 'Pengelolaan koneksi provider terverifikasi, perutean loopback lokal, dan transparansi biaya token.',
      serviceStatus: 'Status Layanan Router',
      serviceRunning: 'Berjalan pada loopback',
      serviceStopped: 'Layanan Terhenti',
      startService: 'Mulai Layanan',
      stopService: 'Hentikan Layanan',
      tabs: {
        overview: 'Ringkasan',
        providers: 'Akun Provider',
        combos: 'Kebijakan Combo',
        logs: 'Log Permintaan',
        pricing: 'Katalog Harga',
      },
      metrics: {
        totalRequests: 'Total Permintaan',
        inputTokens: 'Token Masuk',
        outputTokens: 'Token Keluar',
        actualCost: 'Biaya Riil Terhitung',
        referenceValue: 'Estimasi Nilai Referensi',
        successRate: 'Tingkat Keberhasilan',
      },
      providers: {
        title: 'Koneksi Provider Terverifikasi',
        addProvider: 'Tambah Provider',
        providerType: 'Tipe Provider',
        accountName: 'Nama Akun / Label',
        apiKey: 'API Key',
        statusConnected: 'Terhubung & Teruji',
        statusDisconnected: 'Belum Terhubung',
        testSuccess: 'Koneksi Berhasil',
        testFailed: 'Koneksi Gagal',
        noProviders: 'Belum ada provider yang dikonfigurasi.',
        noProvidersDesc: 'Tambahkan API Key OpenRouter atau aktifkan Mock Provider lokal untuk pengujian.',
        maskNotice: 'Kunci disimpan secara terenkripsi di OS dan disamarkan dari antarmuka.',
      },
      combos: {
        title: 'Kebijakan Perutean & Fallback',
        addCombo: 'Buat Kebijakan Combo Baru',
        noCombos: 'Belum ada kebijakan combo yang dibuat.',
        defaultBadge: 'Default',
        maxAttempts: 'Batas Percobaan',
        cooldown: 'Cooldown Retry',
        candidates: 'Daftar Urutan Kandidat Model',
      },
      logs: {
        title: 'Audit Log & Token Inspector',
        clearLogs: 'Hapus Semua Log',
        confirmClear: 'Apakah Anda yakin ingin menghapus seluruh riwayat log permintaan?',
        noLogs: 'Belum ada riwayat permintaan yang dicatat.',
        correlationId: 'ID Korelasi',
        timestamp: 'Waktu',
        model: 'Provider / Model',
        status: 'Status',
        duration: 'Durasi',
        tokens: 'Token Masuk/Keluar',
      },
      pricing: {
        title: 'Katalog Snapshot Harga Terverifikasi',
        subtitle: 'Snapshot harga referensi resmi per 1 juta token. Stratos tidak pernah mengarang harga palsu.',
        model: 'Model',
        inputCost: 'Harga Input / 1M',
        outputCost: 'Harga Output / 1M',
        source: 'Sumber Resmi',
        effectiveDate: 'Tanggal Berlaku',
        note: 'Biaya riil dan estimasi nilai dipisahkan secara jujur sesuai ADR-010.',
      },
    },
    settings: {
      title: 'Pengaturan Sistem',
      subtitle: 'Konfigurasi tampilan, bahasa, dan verifikasi batas keamanan lingkungan.',
      appearanceSection: 'Tema & Tampilan',
      themeLabel: 'Tema Antarmuka',
      themeObsidianDesc: 'Gelap, kontras tinggi yang nyaman untuk mata (Obsidian Slate #0A0D14)',
      themeNordicDesc: 'Terang, bersih, dan sejuk khas Skandinavia (Soft Nordic Ice #F4F6F9)',
      languageSection: 'Bahasa (Localization)',
      languageLabel: 'Bahasa Aplikasi',
      securitySection: 'Batas Hak Istimewa & Keamanan (SEC-001 s.d. SEC-003)',
      securitySubtitle: 'Status konfigurasi Electron runtime dan isolasi privilege renderer.',
      contextIsolationLabel: 'Context Isolation',
      nodeIntegrationLabel: 'Node.js Integration di Renderer',
      sandboxLabel: 'Renderer Sandbox',
      electronVersionLabel: 'Versi Electron',
      chromeVersionLabel: 'Versi Chromium',
      nodeVersionLabel: 'Versi Node.js',
      platformLabel: 'Target Platform',
    },
    placeholders: {
      workspaceNoticeTitle: 'Workspace Coding (Milestone 3)',
      workspaceNoticeDesc: 'Fitur Monaco Editor, file tree aman, terminal xterm.js, dan review diff agen akan diaktifkan secara bertahap pada Milestone 3.',
      routerNoticeTitle: 'Perute AI & Pengelolaan Akun (Milestone 2)',
      routerNoticeDesc: 'Fitur adapter provider pertama, routing kebijakan, log panggilan aman, dan kuota pemakaian akan diaktifkan pada Milestone 2.',
      backToLauncher: 'Kembali ke Beranda',
    },
  },
  'en-US': {
    common: {
      appName: 'Stratos',
      tagline: 'Local-first AI Router & Dual-mode Coding Workspace',
      version: 'Version',
      ready: 'Ready',
      active: 'Active',
      notConfigured: 'Not Configured',
      plannedMilestone: 'Available in Milestone',
      docs: 'Documentation',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      test: 'Test Connection',
      loading: 'Loading...',
    },
    nav: {
      launcher: 'Launcher',
      workspace: 'IDE Workspace',
      router: 'AI Router',
      settings: 'Settings',
    },
    header: {
      themeDark: 'Obsidian Slate',
      themeLight: 'Soft Nordic Ice',
      localeId: 'Bahasa Indonesia',
      localeEn: 'English',
      securityBadge: 'Isolated Sandbox',
    },
    launcher: {
      welcomeTitle: 'Welcome to Stratos',
      welcomeSubtitle: 'A secure, transparent local-first AI router and desktop coding workspace.',
      ideCardTitle: 'IDE Coding Mode',
      ideCardDesc: 'Professional workspace featuring recursive file exploration, line-numbered editor, diff review, and coding agent.',
      terminalCardTitle: 'Terminal Coding Mode',
      terminalCardDesc: 'Terminal-centric workspace designed for interactive workflows and controlled Windows PowerShell execution.',
      providerSectionTitle: 'AI Connection Status',
      noProviderTitle: 'No Providers Connected',
      noProviderDesc: 'Stratos operates locally. Connect your AI provider API key to begin routing model requests.',
      noProviderHonestNote: 'Per PRD: Connect an OpenRouter API key in the AI Router menu to enable coding agent features.',
      recentWorkspacesTitle: 'Recent Workspaces',
      noRecentWorkspaces: 'No project folders opened yet.',
      actions: {
        openFolder: 'Open Workspace Folder',
        configureRouter: 'Open Router Settings',
        viewDocs: 'View PRD Documents',
      },
    },
    router: {
      title: 'AI Router & Provider Dashboard',
      subtitle: 'Verified provider account management, local loopback routing, and token cost transparency.',
      serviceStatus: 'Router Service Status',
      serviceRunning: 'Running on loopback',
      serviceStopped: 'Service Stopped',
      startService: 'Start Service',
      stopService: 'Stop Service',
      tabs: {
        overview: 'Overview',
        providers: 'Providers',
        combos: 'Combos & Routing',
        logs: 'Request Logs',
        pricing: 'Pricing Catalog',
      },
      metrics: {
        totalRequests: 'Total Requests',
        inputTokens: 'Input Tokens',
        outputTokens: 'Output Tokens',
        actualCost: 'Billed Cost',
        referenceValue: 'Estimated Reference Value',
        successRate: 'Success Rate',
      },
      providers: {
        title: 'Verified Provider Connections',
        addProvider: 'Add Provider',
        providerType: 'Provider Type',
        accountName: 'Account Label',
        apiKey: 'API Key',
        statusConnected: 'Connected & Tested',
        statusDisconnected: 'Disconnected',
        testSuccess: 'Connection Successful',
        testFailed: 'Connection Failed',
        noProviders: 'No providers configured yet.',
        noProvidersDesc: 'Add an OpenRouter API key or enable the local Mock Provider for testing.',
        maskNotice: 'Keys are encrypted on the OS store and masked in the user interface.',
      },
      combos: {
        title: 'Routing & Fallback Policies',
        addCombo: 'Create New Combo',
        noCombos: 'No combo policies created yet.',
        defaultBadge: 'Default',
        maxAttempts: 'Max Attempts',
        cooldown: 'Retry Cooldown',
        candidates: 'Candidate Order',
      },
      logs: {
        title: 'Audit Logs & Token Inspector',
        clearLogs: 'Clear Logs',
        confirmClear: 'Are you sure you want to permanently clear all request history?',
        noLogs: 'No request history recorded yet.',
        correlationId: 'Correlation ID',
        timestamp: 'Time',
        model: 'Provider / Model',
        status: 'Status',
        duration: 'Duration',
        tokens: 'Input / Output Tokens',
      },
      pricing: {
        title: 'Verified Pricing Snapshots',
        subtitle: 'Official reference prices per 1 million tokens. Stratos never invents artificial prices.',
        model: 'Model',
        inputCost: 'Input Cost / 1M',
        outputCost: 'Output Cost / 1M',
        source: 'Official Source',
        effectiveDate: 'Effective Date',
        note: 'Billed cost and estimated reference values are honestly separated per ADR-010.',
      },
    },
    settings: {
      title: 'System Settings',
      subtitle: 'Manage appearance, language, and verify environment security boundaries.',
      appearanceSection: 'Theme & Appearance',
      themeLabel: 'Interface Theme',
      themeObsidianDesc: 'Deep, eye-friendly high contrast (Obsidian Slate #0A0D14)',
      themeNordicDesc: 'Clean, light, and cool Nordic aesthetic (Soft Nordic Ice #F4F6F9)',
      languageSection: 'Language (Localization)',
      languageLabel: 'Application Language',
      securitySection: 'Privilege Boundaries & Security (SEC-001 - SEC-003)',
      securitySubtitle: 'Runtime configuration status and renderer privilege isolation.',
      contextIsolationLabel: 'Context Isolation',
      nodeIntegrationLabel: 'Node.js Integration in Renderer',
      sandboxLabel: 'Renderer Sandbox',
      electronVersionLabel: 'Electron Version',
      chromeVersionLabel: 'Chromium Version',
      nodeVersionLabel: 'Node.js Version',
      platformLabel: 'Target Platform',
    },
    placeholders: {
      workspaceNoticeTitle: 'Coding Workspace (Milestone 3)',
      workspaceNoticeDesc: 'Monaco Editor, secure filesystem tree, xterm.js terminal, and agent diff review will be implemented in Milestone 3.',
      routerNoticeTitle: 'AI Router & Account Management (Milestone 2)',
      routerNoticeDesc: 'Initial verified provider adapter, routing policies, audited call logging, and usage tracking will be enabled in Milestone 2.',
      backToLauncher: 'Back to Launcher',
    },
  },
};
