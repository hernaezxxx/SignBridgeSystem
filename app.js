/**
 * Sign Bridge - Assistive Voice-to-Text for Deaf Individuals
 * Developed by Connectiva Technologies
 * 
 * Features:
 * - 100% Mobile & Desktop Voice Recognition (Android, iOS, PC, Mac)
 * - Native Filipino (fil-PH) & English (en-US) support
 * - Clean mobile toolbar layout with zero overlapping
 * - Top Mic ON / OFF toggle button (instant mute/unmute control)
 * - Automatic speech recognition with continuous auto-restart watchdog
 * - Hardware conflict-free audio visualizer (safe for all phones)
 * - Real-time Voice Clarity & Signal Quality Meter
 * - Interactive Guide for Deaf Individuals
 * - Smart English & Filipino punctuation and sentence capitalization
 * - Maximized Big Screen captions for mobile and desktop reading
 * - Real-time visual audio waveform & peripheral sound pulse
 * - Fullscreen presentation mode
 * - Persistent conversation history log
 * - Mobile HTTPS Secure Context detection and 1-tap switcher
 */

// ============================================================================
// State Management
// ============================================================================
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (typeof window !== 'undefined' && window.innerWidth <= 768 && 'ontouchstart' in window);

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const state = {
  isMicActive: true,
  isMobile: isMobileDevice,
  isIOS: isIOS,
  recognition: null,
  recognitionRunning: false,
  finalTranscript: '',
  interimTranscript: '',
  language: 'fil-PH', // Default to Filipino
  fontSize: 'font-large',

  // Live Speech & Audio Visualizer State
  isSpeechActive: false,
  speechEnergy: 0,
  lastActiveTime: Date.now(),
  audioContext: null,
  analyser: null,
  audioSource: null,
  audioStream: null,
  visualizerAnimationId: null,

  // Conversation History & Timers
  messages: [],
  restartTimeout: null,
  watchdogInterval: null
};

// ============================================================================
// DOM Elements
// ============================================================================
const elements = {
  soundAlertOverlay: document.getElementById('soundAlertOverlay'),
  gestureStartOverlay: document.getElementById('gestureStartOverlay'),
  gestureStartBtn: document.getElementById('gestureStartBtn'),
  insecureBanner: document.getElementById('insecureBanner'),
  switchHttpsBtn: document.getElementById('switchHttpsBtn'),
  inAppBrowserBanner: document.getElementById('inAppBrowserBanner'),
  closeInAppBannerBtn: document.getElementById('closeInAppBannerBtn'),
  iosFilipinoNotice: document.getElementById('iosFilipinoNotice'),
  closeIosNoticeBtn: document.getElementById('closeIosNoticeBtn'),

  // Deaf Guide Modal
  deafGuideModal: document.getElementById('deafGuideModal'),
  deafGuideBtn: document.getElementById('deafGuideBtn'),
  closeDeafGuideBtn: document.getElementById('closeDeafGuideBtn'),
  deafGuideGotItBtn: document.getElementById('deafGuideGotItBtn'),

  // Language Selection Modal
  langModal: document.getElementById('langModal'),
  closeLangModalBtn: document.getElementById('closeLangModalBtn'),
  closeLangModalBottomBtn: document.getElementById('closeLangModalBottomBtn'),
  langSearchInput: document.getElementById('langSearchInput'),
  featuredLangGrid: document.getElementById('featuredLangGrid'),
  allLangGrid: document.getElementById('allLangGrid'),
  langToggleBtn: document.getElementById('langToggleBtn'),

  // Header controls
  headerMicToggleBtn: document.getElementById('headerMicToggleBtn'),
  headerMicIcon: document.getElementById('headerMicIcon'),
  fontSizeCycleBtn: document.getElementById('fontSizeCycleBtn'),
  fontSizeSelector: document.getElementById('fontSizeSelector'),
  langSelector: document.getElementById('langSelector'),
  historyDrawerBtn: document.getElementById('historyDrawerBtn'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  fullscreenToggleBtn: document.getElementById('fullscreenToggleBtn'),

  // Billboard
  billboardCard: document.getElementById('billboardCard'),
  liveDot: document.getElementById('liveDot'),
  liveStatusText: document.getElementById('liveStatusText'),
  clarityMeter: document.getElementById('clarityMeter'),
  clarityBars: document.querySelectorAll('.c-bar'),
  clarityLabel: document.getElementById('clarityLabel'),
  copyTranscriptBtn: document.getElementById('copyTranscriptBtn'),
  clearCurrentBtn: document.getElementById('clearCurrentBtn'),
  liveTextContainer: document.getElementById('liveTextContainer'),
  liveTextPlaceholder: document.getElementById('liveTextPlaceholder'),
  transcriptStream: document.getElementById('transcriptStream'),
  finalTranscriptText: document.getElementById('finalTranscriptText'),
  interimTranscriptText: document.getElementById('interimTranscriptText'),

  // Live Monitor Footer
  audioVisualizer: document.getElementById('audioVisualizer'),
  monitorStatusLabel: document.getElementById('monitorStatusLabel'),

  // History Drawer
  historyDrawer: document.getElementById('historyDrawer'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  chatLogContainer: document.getElementById('chatLogContainer'),
  emptyChatState: document.getElementById('emptyChatState'),
  exportLogBtn: document.getElementById('exportLogBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // Fullscreen Presentation Mode
  presentationOverlay: document.getElementById('presentationOverlay'),
  presClearBtn: document.getElementById('presClearBtn'),
  exitPresentationBtn: document.getElementById('exitPresentationBtn'),
  presFinalText: document.getElementById('presFinalText'),
  presInterimText: document.getElementById('presInterimText'),

  // Toast
  toastNotification: document.getElementById('toastNotification')
};

// ============================================================================
// Toast Notification
// ============================================================================
let toastTimeout = null;
function showToast(message, duration = 3000) {
  if (!elements.toastNotification) return;
  elements.toastNotification.textContent = message;
  elements.toastNotification.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toastNotification.classList.remove('show');
  }, duration);
}

// ============================================================================
// Mobile Compatibility Checks (HTTPS, In-App Browser, & iOS Dictation Guidance)
// ============================================================================
function checkMobileEnvironment() {
  const hostname = window.location.hostname;
  const isLocal = ['localhost', '127.0.0.1'].includes(hostname);
  const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocal;

  // 1. Insecure HTTP check
  if (!isSecure && elements.insecureBanner) {
    elements.insecureBanner.style.display = 'block';
    if (elements.switchHttpsBtn) {
      elements.switchHttpsBtn.href = `https://${hostname}:8443${window.location.pathname}`;
      elements.switchHttpsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `https://${hostname}:8443${window.location.pathname}`;
      });
    }
  } else if (elements.insecureBanner) {
    elements.insecureBanner.style.display = 'none';
  }

  // 2. In-App browser check (Messenger, Instagram, TikTok, Line, etc.)
  const isInApp = /FBAN|FBAV|Instagram|TikTok|Line|Snapchat/i.test(navigator.userAgent);
  if (isInApp && elements.inAppBrowserBanner) {
    elements.inAppBrowserBanner.style.display = 'block';
  }

  // 3. iOS Filipino limitation notice
  checkIosNotice();
}

function checkIosNotice() {
  if (!elements.iosFilipinoNotice) return;
  if (state.isIOS && (state.language === 'fil-PH' || state.language === 'tl-PH')) {
    elements.iosFilipinoNotice.style.display = 'block';
  } else {
    elements.iosFilipinoNotice.style.display = 'none';
  }
}

// ============================================================================
// Visual Sound Pulse (Peripheral Visual Cue for Deaf Individual)
// ============================================================================
function triggerVisualSoundPulse() {
  if (!elements.soundAlertOverlay) return;
  elements.soundAlertOverlay.classList.add('flash-active');
  setTimeout(() => {
    elements.soundAlertOverlay.classList.remove('flash-active');
  }, 400);
}

// ============================================================================
// Comprehensive Multi-Language System (All World Languages)
// ============================================================================
const ALL_LANGUAGES = [
  // Featured / Primary
  { code: 'fil-PH', name: 'Filipino (Tagalog)', native: 'Wikang Filipino', flag: '🇵🇭', featured: true },
  { code: 'en-US', name: 'English (US)', native: 'English (United States)', flag: '🇺🇸', featured: true },
  { code: 'en-GB', name: 'English (UK)', native: 'English (United Kingdom)', flag: '🇬🇧', featured: true },
  { code: 'es-ES', name: 'Spanish', native: 'Español', flag: '🇪🇸', featured: true },
  { code: 'ja-JP', name: 'Japanese', native: '日本語', flag: '🇯🇵', featured: true },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '普通话 (中国)', flag: '🇨🇳', featured: true },

  // World Languages
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '國語 (台灣)', flag: '🇹🇼' },
  { code: 'zh-HK', name: 'Cantonese', native: '粵語 (香港)', flag: '🇭🇰' },
  { code: 'ko-KR', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  { code: 'fr-FR', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'ru-RU', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms-MY', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th-TH', name: 'Thai', native: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', native: 'العربية', flag: '🇸🇦' },
  { code: 'tr-TR', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
  { code: 'nl-NL', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl-PL', name: 'Polish', native: 'Polski', flag: '🇵🇱' },
  { code: 'sv-SE', name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
  { code: 'en-AU', name: 'English (Australia)', native: 'English (Australia)', flag: '🇦🇺' },
  { code: 'en-CA', name: 'English (Canada)', native: 'English (Canada)', flag: '🇨🇦' },
  { code: 'en-IN', name: 'English (India)', native: 'English (India)', flag: '🇮🇳' },
  { code: 'es-MX', name: 'Spanish (Mexico)', native: 'Español (México)', flag: '🇲🇽' }
];

function createLangCardHtml(item) {
  const isSelected = item.code === state.language || (state.language === 'tl-PH' && item.code === 'fil-PH');
  return `
    <div class="lang-card ${isSelected ? 'is-selected' : ''}" data-code="${item.code}">
      <div class="lang-card-left">
        <span class="lang-flag">${item.flag}</span>
        <div class="lang-info">
          <span class="lang-name">${escapeHTML(item.name)}</span>
          <span class="lang-native">${escapeHTML(item.native)}</span>
        </div>
      </div>
      <div class="lang-card-right">
        <span class="lang-badge-code">${item.code}</span>
        <svg class="lang-check-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  `;
}

function renderLanguageModal(filterQuery = '') {
  if (!elements.featuredLangGrid || !elements.allLangGrid) return;
  const q = filterQuery.trim().toLowerCase();

  const matches = (lang) => {
    if (!q) return true;
    return lang.name.toLowerCase().includes(q) ||
      lang.native.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q);
  };

  const featuredList = ALL_LANGUAGES.filter(l => l.featured && matches(l));
  const worldList = ALL_LANGUAGES.filter(l => !l.featured && matches(l));

  elements.featuredLangGrid.innerHTML = featuredList.map(createLangCardHtml).join('');
  elements.allLangGrid.innerHTML = worldList.map(createLangCardHtml).join('');

  // Attach click listener to each language card
  if (elements.langModal) {
    const cards = elements.langModal.querySelectorAll('.lang-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const code = card.getAttribute('data-code');
        if (code) {
          selectLanguage(code);
        }
      });
    });
  }
}

function selectLanguage(code) {
  const langObj = ALL_LANGUAGES.find(l => l.code === code);
  switchLanguage(code);
  renderLanguageModal(elements.langSearchInput ? elements.langSearchInput.value : '');

  const langName = langObj ? langObj.name : code;
  showToast(`Language set to ${langName}`);

  setTimeout(() => {
    if (elements.langModal) elements.langModal.style.display = 'none';
  }, 220);
}

// ============================================================================
// Smart Punctuation & Capitalization Engine (English & Filipino/Tagalog)
// ============================================================================
function formatSentence(rawText) {
  if (!rawText) return '';
  let str = rawText.trim();
  if (str.length === 0) return '';

  // Capitalize first character
  str = str.charAt(0).toUpperCase() + str.slice(1);

  // Check if string already ends with punctuation
  const lastChar = str.slice(-1);
  if (['.', '!', '?', ',', ':', ';'].includes(lastChar)) {
    return str;
  }

  // Detect common question starters in English and Filipino (Tagalog)
  const lower = str.toLowerCase();
  const questionStarters = [
    // English question starters
    'who ', 'what ', 'where ', 'when ', 'why ', 'how ', 'can you', 'could you', 'would you',
    'is it', 'are you', 'do you', 'did you', 'will you', 'should i', 'can i', 'how are',
    // Filipino / Tagalog question starters
    'ano ', 'anong ', 'sino ', 'sinong ', 'saan ', 'saang ', 'nasaan ', 'kailan ',
    'bakit ', 'paano ', 'paanong ', 'gaano ', 'magkano ', 'alin ', 'aling ', 'kanino ',
    'kaninong ', 'kamusta ', 'kumusta ', 'pwede ba', 'puwede ba', 'maaari ba',
    'mayroon ba', 'meron ba', 'totoo ba', 'ayaw mo ba', 'gusto mo ba', 'taga saan'
  ];

  // Also check if question particle "ba" is present
  const hasTagalogQuestionParticle = /\bba\b/i.test(lower);
  const isQuestion = questionStarters.some(starter => lower.startsWith(starter)) || hasTagalogQuestionParticle;

  return isQuestion ? str + '?' : str + '.';
}

// Filter out accidental Asian/Japanese characters on iOS only if Filipino/Tagalog was selected
function cleanTranscriptText(text) {
  if (!text) return '';
  if (state.isIOS && (state.language === 'fil-PH' || state.language === 'tl-PH')) {
    return text.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/g, '').trim();
  }
  return text;
}

// ============================================================================
// Automatic Speech Recognition Engine (Web Speech API)
// ============================================================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('Speech Recognition not supported in this browser. Please use Chrome or Edge.', 8000);
    if (elements.liveStatusText) {
      elements.liveStatusText.textContent = 'Speech Recognition Not Supported (Use Chrome/Edge)';
    }
    return false;
  }

  // Cleanly abort previous instance if any
  if (state.recognition) {
    try {
      state.recognition.onstart = null;
      state.recognition.onspeechstart = null;
      state.recognition.onspeechend = null;
      state.recognition.onresult = null;
      state.recognition.onerror = null;
      state.recognition.onend = null;
      state.recognition.abort();
    } catch (e) {}
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = state.language;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.recognitionRunning = true;
    state.lastActiveTime = Date.now();
    if (state.isMicActive) {
      updateMonitorUI(true, 'Voice Detection: Active • Ready');
    }
    if (elements.gestureStartOverlay) {
      elements.gestureStartOverlay.style.display = 'none';
    }
  };

  recognition.onspeechstart = () => {
    if (state.isMicActive) {
      state.isSpeechActive = true;
      state.lastActiveTime = Date.now();
      state.speechEnergy = Math.max(state.speechEnergy, 0.7);
      updateMonitorUI(true, '🗣️ Hearing Speaker is Talking...');
      triggerVisualSoundPulse();
    }
  };

  recognition.onspeechend = () => {
    state.isSpeechActive = false;
    if (state.isMicActive) {
      updateMonitorUI(true, 'Voice Detection: Active • Ready');
    }
  };

  recognition.onresult = (event) => {
    if (!state.isMicActive) return;
    state.lastActiveTime = Date.now();
    state.isSpeechActive = true;
    state.speechEnergy = 1.0;

    let interim = '';
    let newlyFinalized = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptSegment = cleanTranscriptText(event.results[i][0].transcript);
      if (event.results[i].isFinal) {
        newlyFinalized += transcriptSegment;
      } else {
        interim += transcriptSegment;
      }
    }

    if (newlyFinalized.trim().length > 0) {
      const cleanFinal = formatSentence(newlyFinalized);
      if (cleanFinal.length > 0) {
        state.finalTranscript = (state.finalTranscript + ' ' + cleanFinal).trim();
        addHistoryItem('Hearing Speaker', cleanFinal);
        triggerVisualSoundPulse();
      }
    }

    state.interimTranscript = interim;
    renderTranscripts();
  };

  recognition.onerror = (event) => {
    console.warn('[Sign Bridge] Speech recognition error event:', event.error);

    if (event.error === 'not-allowed') {
      state.recognitionRunning = false;
      const hostname = window.location.hostname;
      const isLocal = ['localhost', '127.0.0.1'].includes(hostname);
      const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocal;

      if (!isSecure && elements.insecureBanner) {
        elements.insecureBanner.style.display = 'block';
        showToast('Microphone blocked on HTTP. Please switch to HTTPS on your phone!', 8000);
      } else {
        if (elements.gestureStartOverlay) {
          elements.gestureStartOverlay.style.display = 'flex';
        }
        showToast('Please allow microphone access in your browser settings.', 6000);
      }
    } else if (event.error === 'language-not-supported') {
      // Auto-fallback between fil-PH and tl-PH for Android models
      if (state.language === 'fil-PH') {
        state.language = 'tl-PH';
        switchLanguage('tl-PH');
      }
    } else if (event.error === 'no-speech') {
      state.isSpeechActive = false;
      if (state.isMicActive) scheduleAutoRestart(80);
    } else if (event.error === 'network') {
      state.isSpeechActive = false;
      if (state.isMicActive) scheduleAutoRestart(750);
    } else if (event.error === 'audio-capture') {
      state.recognitionRunning = false;
      state.isSpeechActive = false;
      if (state.isMicActive) {
        setTimeout(() => {
          state.recognition = null;
          startListening();
        }, 500);
      }
    } else if (event.error === 'aborted') {
      state.recognitionRunning = false;
      state.isSpeechActive = false;
      if (state.isMicActive) scheduleAutoRestart(180);
    }
  };

  recognition.onend = () => {
    state.recognitionRunning = false;
    state.isSpeechActive = false;
    if (state.isMicActive) {
      scheduleAutoRestart(state.isMobile ? 180 : 100);
    }
  };

  state.recognition = recognition;
  return true;
}

function scheduleAutoRestart(delay = 150) {
  clearTimeout(state.restartTimeout);
  state.restartTimeout = setTimeout(() => {
    if (state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
  }, delay);
}

function startListening() {
  if (!state.isMicActive) return;
  // On mobile devices, always re-instantiate SpeechRecognition for clean state to prevent zombie engine
  if (!state.recognition || state.isMobile) {
    if (!initSpeechRecognition()) return;
  }

  try {
    state.recognition.lang = state.language;
    state.recognition.start();
    initAudioVisualizer();
  } catch (error) {
    if (error.name === 'InvalidStateError') {
      state.recognitionRunning = true;
    } else {
      console.warn('[Sign Bridge] startListening notice:', error.message);
      state.recognitionRunning = false;
      scheduleAutoRestart(350);
    }
  }
}

function stopListening() {
  clearTimeout(state.restartTimeout);
  state.recognitionRunning = false;
  state.isSpeechActive = false;
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {
      try { state.recognition.abort(); } catch (e2) {}
    }
  }
}

function switchLanguage(newLang) {
  state.language = newLang;
  if (elements.langSelector) {
    elements.langSelector.value = newLang;
  }
  checkIosNotice();

  const langObj = ALL_LANGUAGES.find(l => l.code === newLang);
  const langName = langObj ? langObj.name : newLang;
  if (elements.langToggleBtn) {
    elements.langToggleBtn.setAttribute('title', `Current Language: ${langName} (Tap to Change)`);
  }

  // Stop and completely recreate recognition instance with the new language
  stopListening();
  state.recognition = null;
  state.recognitionRunning = false;
  if (state.isMicActive) {
    scheduleAutoRestart(120);
  }
}

// Watchdog to ensure speech recognition stays alive when Mic is ON
function startWatchdog() {
  if (state.watchdogInterval) clearInterval(state.watchdogInterval);
  state.watchdogInterval = setInterval(() => {
    if (state.isMicActive) {
      if (!state.recognitionRunning) {
        startListening();
      } else if (state.isMobile && Date.now() - state.lastActiveTime > 25000) {
        // Cycle cleanly if mobile audio stream silently timed out
        try {
          state.recognition.stop();
        } catch (e) {
          try { state.recognition.abort(); } catch (e2) {}
        }
        state.recognitionRunning = false;
        scheduleAutoRestart(150);
      }
    }
  }, 2500);
}

// ============================================================================
// Top Mic ON / OFF Toggle Action (Icon-Only - NO TEXT)
// ============================================================================
function toggleMicrophone() {
  state.isMicActive = !state.isMicActive;

  if (state.isMicActive) {
    elements.headerMicToggleBtn.classList.remove('is-muted');
    elements.headerMicToggleBtn.classList.add('is-active');
    elements.headerMicToggleBtn.setAttribute('title', 'Microphone Active (Tap to Mute)');
    elements.headerMicIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    `;
    updateMonitorUI(true, 'Voice Detection: Active • Ready');
    startListening();
    showToast('Microphone ON • Ready for speech');
  } else {
    stopListening();
    elements.headerMicToggleBtn.classList.remove('is-active');
    elements.headerMicToggleBtn.classList.add('is-muted');
    elements.headerMicToggleBtn.setAttribute('title', 'Microphone Muted (Tap to Activate)');
    elements.headerMicIcon.innerHTML = `
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    `;
    elements.liveStatusText.textContent = '🔇 Microphone Paused (Tap the Mic icon above to resume)';
    elements.liveDot.classList.remove('active');
    elements.billboardCard.classList.remove('is-listening');
    elements.monitorStatusLabel.textContent = 'Voice Detection: Paused';
    updateClarityMeter(0);
    showToast('Microphone Paused (Turned OFF)');
  }
}

function updateMonitorUI(isActive, statusMsg) {
  if (elements.liveDot) {
    elements.liveDot.classList.toggle('active', isActive && state.isMicActive);
  }
  if (elements.billboardCard) {
    elements.billboardCard.classList.toggle('is-listening', isActive && state.isMicActive);
  }
  if (elements.liveStatusText) {
    if (!state.isMicActive) {
      elements.liveStatusText.textContent = '🔇 Microphone Paused (Click "Mic OFF" above to resume)';
    } else {
      elements.liveStatusText.textContent = isActive
        ? (statusMsg.includes('Talking') ? '🗣️ Hearing speaker is speaking...' : 'Listening automatically... Ready for speech')
        : 'Connecting microphone...';
    }
  }
  if (elements.monitorStatusLabel) {
    elements.monitorStatusLabel.textContent = state.isMicActive ? statusMsg : 'Voice Detection: Paused';
  }
}

function renderTranscripts() {
  const hasText = state.finalTranscript.length > 0 || state.interimTranscript.length > 0;

  if (hasText) {
    elements.liveTextPlaceholder.style.display = 'none';
    elements.transcriptStream.style.display = 'block';

    elements.finalTranscriptText.textContent = state.finalTranscript ? state.finalTranscript + ' ' : '';
    elements.interimTranscriptText.textContent = state.interimTranscript;

    elements.presFinalText.textContent = state.finalTranscript ? state.finalTranscript + ' ' : '';
    elements.presInterimText.textContent = state.interimTranscript;

    elements.liveTextContainer.scrollTop = elements.liveTextContainer.scrollHeight;
  } else {
    elements.liveTextPlaceholder.style.display = 'flex';
    elements.transcriptStream.style.display = 'none';
    elements.presFinalText.textContent = 'Listening... Spoken voice will appear here automatically.';
    elements.presInterimText.textContent = '';
  }
}

function clearCurrentBillboard() {
  if (!state.finalTranscript && !state.interimTranscript) {
    showToast('Screen is already clear');
    return;
  }
  state.finalTranscript = '';
  state.interimTranscript = '';
  renderTranscripts();
  showToast('Screen cleared. Ready for next conversation.');
}

function copyTranscriptToClipboard() {
  const fullText = (state.finalTranscript + ' ' + state.interimTranscript).trim();
  if (!fullText) {
    showToast('Nothing to copy yet.');
    return;
  }

  navigator.clipboard.writeText(fullText).then(() => {
    showToast('Copied captions to clipboard!');
  }).catch(() => {
    showToast('Unable to copy to clipboard.');
  });
}

// ============================================================================
// Studio-Grade Microphone Audio Filtering & Visualizer
// ============================================================================
async function initAudioVisualizer() {
  // On mobile devices, avoid opening getUserMedia to prevent hardware mic locking with SpeechRecognition
  if (state.isMobile) {
    drawVisualizer();
    return;
  }

  // On desktop / PC, enable studio hardware audio analyzer
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      drawVisualizer();
      return;
    }

    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') {
      await state.audioContext.resume();
    }

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48000
    };

    if (!state.audioStream) {
      state.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });
    }

    if (!state.analyser) {
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 64;
      state.analyser.smoothingTimeConstant = 0.82;
    }

    if (state.audioSource) {
      state.audioSource.disconnect();
    }
    state.audioSource = state.audioContext.createMediaStreamSource(state.audioStream);
    state.audioSource.connect(state.analyser);

    drawVisualizer();
  } catch (error) {
    console.warn('[Sign Bridge] Hardware mic analyzer fallback:', error.message);
    drawVisualizer();
  }
}

function updateClarityMeter(activeLevel) {
  if (!state.isMicActive) {
    elements.clarityBars.forEach(bar => bar.className = 'c-bar');
    elements.clarityLabel.textContent = 'Muted';
    elements.clarityLabel.style.color = 'var(--text-muted)';
    return;
  }

  elements.clarityBars.forEach((bar, idx) => {
    bar.className = 'c-bar';
    if (idx < activeLevel) {
      if (activeLevel === 1) {
        bar.classList.add('level-low');
      } else if (activeLevel === 4) {
        bar.classList.add('level-loud');
      } else {
        bar.classList.add('level-good');
      }
    }
  });

  if (activeLevel === 0) {
    elements.clarityLabel.textContent = 'Listening';
    elements.clarityLabel.style.color = 'var(--text-muted)';
  } else if (activeLevel === 1) {
    elements.clarityLabel.textContent = 'Quiet (Speak Closer)';
    elements.clarityLabel.style.color = 'var(--accent-amber)';
  } else if (activeLevel === 2 || activeLevel === 3) {
    elements.clarityLabel.textContent = 'Clear & Strong';
    elements.clarityLabel.style.color = 'var(--accent-emerald)';
  } else {
    elements.clarityLabel.textContent = 'Very Loud';
    elements.clarityLabel.style.color = 'var(--accent-rose)';
  }
}

function resizeVisualizerCanvas() {
  const canvas = elements.audioVisualizer;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0) {
    canvas.width = Math.floor(rect.width * window.devicePixelRatio || rect.width);
    canvas.height = 44 * (window.devicePixelRatio || 1);
  }
}

function drawVisualizer() {
  resizeVisualizerCanvas();
  const canvas = elements.audioVisualizer;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const bufferLength = (state.analyser && state.audioStream) ? state.analyser.frequencyBinCount : 32;
  const dataArray = new Uint8Array(bufferLength);

  let phase = 0;

  function renderFrame() {
    state.visualizerAnimationId = requestAnimationFrame(renderFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let sum = 0;
    let rms = 0;

    if (state.analyser && state.isMicActive && state.audioStream) {
      state.analyser.getByteFrequencyData(dataArray);
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      rms = Math.sqrt(sum / bufferLength);
    } else if (state.isMicActive) {
      // Dynamic Speech Energy Mode (Mobile & Desktop fallback)
      state.speechEnergy = Math.max(0, state.speechEnergy * 0.94);
      phase += 0.06 + (state.speechEnergy * 0.1);
      
      const hasSpeech = state.isSpeechActive || state.speechEnergy > 0.08;
      rms = hasSpeech ? (30 + state.speechEnergy * 80) : 0;

      for (let i = 0; i < bufferLength; i++) {
        if (hasSpeech) {
          const harmonic = Math.sin(phase * 1.6 + i * 0.35) * 0.5 + 0.5;
          const sub = Math.cos(phase * 0.9 + i * 0.2) * 0.5 + 0.5;
          const center = 1 - Math.abs((i - bufferLength / 2) / (bufferLength / 2)) * 0.35;
          const val = (harmonic * 0.6 + sub * 0.4) * (state.speechEnergy || 0.6) * 190 * center + 25;
          dataArray[i] = Math.min(255, Math.max(10, val));
        } else {
          dataArray[i] = Math.max(5, Math.sin(phase * 0.5 + i * 0.3) * 7 + 10);
        }
      }
    }

    // Update Clarity & Volume Meter
    if (!state.isMicActive) {
      updateClarityMeter(0);
    } else if (rms < 8) {
      updateClarityMeter(0);
    } else if (rms < 24) {
      updateClarityMeter(1);
    } else if (rms < 75) {
      updateClarityMeter(2);
    } else if (rms < 140) {
      updateClarityMeter(3);
    } else {
      updateClarityMeter(4);
    }

    const hasSoundActivity = state.isMicActive && rms >= 10;
    const barWidth = (canvas.width / bufferLength) * 0.92;
    let x = (canvas.width - (barWidth * bufferLength)) / 2;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = Math.max(3, (dataArray[i] / 255) * (canvas.height - 8));
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      if (hasSoundActivity) {
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(0.5, '#06b6d4');
        gradient.addColorStop(1, '#10b981');
      } else {
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.15)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, canvas.height - barHeight, barWidth - 3, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      x += barWidth;
    }
  }

  if (state.visualizerAnimationId) {
    cancelAnimationFrame(state.visualizerAnimationId);
  }
  renderFrame();
}

// ============================================================================
// Conversation History Drawer
// ============================================================================
function addHistoryItem(speaker, text) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const item = { speaker, text, timestamp };
  state.messages.push(item);

  if (elements.historyCountBadge) {
    elements.historyCountBadge.textContent = state.messages.length;
  }

  if (elements.emptyChatState) {
    elements.emptyChatState.style.display = 'none';
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = `
    <div class="bubble-header">
      <span class="bubble-speaker">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        </svg>
        ${escapeHTML(speaker)}
      </span>
      <span class="bubble-time">${timestamp}</span>
    </div>
    <div class="bubble-text">${escapeHTML(text)}</div>
  `;

  elements.chatLogContainer.appendChild(bubble);
  elements.chatLogContainer.scrollTop = elements.chatLogContainer.scrollHeight;
}

function clearHistory() {
  state.messages = [];
  if (elements.historyCountBadge) elements.historyCountBadge.textContent = '0';
  elements.chatLogContainer.innerHTML = '';
  if (elements.emptyChatState) {
    elements.chatLogContainer.appendChild(elements.emptyChatState);
    elements.emptyChatState.style.display = 'block';
  }
  showToast('Conversation history cleared');
}

function exportHistory() {
  if (state.messages.length === 0) {
    showToast('No history messages to save yet.');
    return;
  }

  let content = `Sign Bridge - Voice to Text Transcript\nDate: ${new Date().toLocaleString()}\n`;
  content += `========================================================\n\n`;

  state.messages.forEach(m => {
    content += `[${m.timestamp}] ${m.speaker}: ${m.text}\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sign_bridge_captions_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Transcript downloaded successfully!');
}

function toggleHistoryDrawer() {
  elements.historyDrawer.classList.toggle('open');
}

function closeHistoryDrawer() {
  elements.historyDrawer.classList.remove('open');
}

// ============================================================================
// Fullscreen Big Screen Presentation Mode
// ============================================================================
function enterPresentationMode() {
  elements.presentationOverlay.style.display = 'flex';
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => { });
  }
}

function exitPresentationMode() {
  elements.presentationOverlay.style.display = 'none';
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => { });
  }
}

// ============================================================================
// Helper Utilities
// ============================================================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// Event Listeners & Auto-Start
// ============================================================================
function setupEventListeners() {
  // Top Mic ON / OFF toggle button
  if (elements.headerMicToggleBtn) {
    elements.headerMicToggleBtn.addEventListener('click', toggleMicrophone);
  }

  // Billboard actions
  elements.clearCurrentBtn.addEventListener('click', clearCurrentBillboard);
  elements.copyTranscriptBtn.addEventListener('click', copyTranscriptToClipboard);

  if (elements.presClearBtn) {
    elements.presClearBtn.addEventListener('click', clearCurrentBillboard);
  }

  // Window resize & orientation change for responsive visualizer canvas
  window.addEventListener('resize', resizeVisualizerCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeVisualizerCanvas, 150);
  });

  // Guide for Deaf People Modal
  if (elements.deafGuideBtn) {
    elements.deafGuideBtn.addEventListener('click', () => {
      elements.deafGuideModal.style.display = 'flex';
    });
  }
  if (elements.closeDeafGuideBtn) {
    elements.closeDeafGuideBtn.addEventListener('click', () => {
      elements.deafGuideModal.style.display = 'none';
    });
  }
  if (elements.deafGuideGotItBtn) {
    elements.deafGuideGotItBtn.addEventListener('click', () => {
      elements.deafGuideModal.style.display = 'none';
    });
  }

  if (elements.deafGuideModal) {
    elements.deafGuideModal.addEventListener('click', (e) => {
      if (e.target === elements.deafGuideModal) {
        elements.deafGuideModal.style.display = 'none';
      }
    });
  }

  // Dismiss iOS Filipino notice
  if (elements.closeIosNoticeBtn) {
    elements.closeIosNoticeBtn.addEventListener('click', () => {
      if (elements.iosFilipinoNotice) {
        elements.iosFilipinoNotice.style.display = 'none';
      }
    });
  }

  // Language button (Icon-only: click to open full Language Selector Modal)
  if (elements.langToggleBtn) {
    elements.langToggleBtn.addEventListener('click', () => {
      if (elements.langModal) {
        elements.langModal.style.display = 'flex';
        renderLanguageModal('');
        if (elements.langSearchInput) {
          elements.langSearchInput.value = '';
          setTimeout(() => elements.langSearchInput.focus(), 120);
        }
      }
    });
  }

  // Close Language Modal triggers
  if (elements.closeLangModalBtn) {
    elements.closeLangModalBtn.addEventListener('click', () => {
      if (elements.langModal) elements.langModal.style.display = 'none';
    });
  }
  if (elements.closeLangModalBottomBtn) {
    elements.closeLangModalBottomBtn.addEventListener('click', () => {
      if (elements.langModal) elements.langModal.style.display = 'none';
    });
  }
  if (elements.langModal) {
    elements.langModal.addEventListener('click', (e) => {
      if (e.target === elements.langModal) {
        elements.langModal.style.display = 'none';
      }
    });
  }

  // Search input live filtering for languages
  if (elements.langSearchInput) {
    elements.langSearchInput.addEventListener('input', (e) => {
      renderLanguageModal(e.target.value);
    });
  }

  // Dismiss In-App Browser (Messenger) notice
  if (elements.closeInAppBannerBtn) {
    elements.closeInAppBannerBtn.addEventListener('click', () => {
      if (elements.inAppBrowserBanner) elements.inAppBrowserBanner.style.display = 'none';
    });
  }

  // Font size cycle button (Icon-only 1-tap cycle)
  const fontSizeCycleBtn = document.getElementById('fontSizeCycleBtn');
  const fontSizes = ['font-normal', 'font-large', 'font-xl', 'font-giant'];
  const fontSizeLabels = ['Standard', 'Large', 'Extra Large', 'Giant'];
  if (fontSizeCycleBtn) {
    fontSizeCycleBtn.addEventListener('click', () => {
      const currentIdx = fontSizes.indexOf(state.fontSize);
      const nextIdx = (currentIdx + 1) % fontSizes.length;
      state.fontSize = fontSizes[nextIdx];
      elements.liveTextContainer.className = `caption-display-area ${state.fontSize}`;
      if (elements.fontSizeSelector) elements.fontSizeSelector.value = state.fontSize;
      showToast(`Text size: ${fontSizeLabels[nextIdx]}`);
    });
  }

  // Font size selector (hidden fallback)
  if (elements.fontSizeSelector) {
    elements.fontSizeSelector.addEventListener('change', (e) => {
      state.fontSize = e.target.value;
      elements.liveTextContainer.className = `caption-display-area ${state.fontSize}`;
    });
  }

  // History drawer
  elements.historyDrawerBtn.addEventListener('click', toggleHistoryDrawer);
  elements.closeDrawerBtn.addEventListener('click', closeHistoryDrawer);
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  elements.exportLogBtn.addEventListener('click', exportHistory);

  // Presentation mode
  elements.fullscreenToggleBtn.addEventListener('click', enterPresentationMode);
  elements.exitPresentationBtn.addEventListener('click', exitPresentationMode);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.presentationOverlay.style.display === 'flex') {
      exitPresentationMode();
    }
  });

  // Gesture activation overlay trigger
  if (elements.gestureStartBtn) {
    elements.gestureStartBtn.addEventListener('click', () => {
      elements.gestureStartOverlay.style.display = 'none';
      startListening();
    });
  }

  // Activate on first gesture if required by browser autoplay policies
  const activateOnFirstGesture = () => {
    if (state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
    document.removeEventListener('click', activateOnFirstGesture);
    document.removeEventListener('touchstart', activateOnFirstGesture);
  };
  document.addEventListener('click', activateOnFirstGesture, { once: true });
  document.addEventListener('touchstart', activateOnFirstGesture, { once: true });

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
  });
}

// ============================================================================
// Front Page: SignBridge by Connectiva Technologies
// ============================================================================
function initFrontPageModule() {
  const frontPageView = document.getElementById('frontPageView');
  const liveAppView = document.getElementById('liveAppView');

  const showFrontPage = () => {
    if (frontPageView && liveAppView) {
      frontPageView.style.display = 'flex';
      liveAppView.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const showLiveApp = () => {
    if (frontPageView && liveAppView) {
      frontPageView.style.display = 'none';
      liveAppView.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (state.isMicActive && !state.recognitionRunning) {
        startListening();
      }
      showToast('SignBridge Live System Started • Listening for speech...', 4000);
    }
  };

  // Start Buttons
  const startBtns = [
    document.getElementById('frontPageStartBtn'),
    document.getElementById('frontNavStartBtn'),
    document.getElementById('protoStartAppBtn'),
    document.getElementById('footerStartBtn')
  ];

  startBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', showLiveApp);
  });

  const returnToFrontBtn = document.getElementById('returnToFrontBtn');
  if (returnToFrontBtn) {
    returnToFrontBtn.addEventListener('click', showFrontPage);
  }

  const appBrandBadge = document.querySelector('.app-header .brand-badge');
  if (appBrandBadge) {
    appBrandBadge.style.cursor = 'pointer';
    appBrandBadge.setAttribute('title', 'Click to Return to SignBridge Front Page');
    appBrandBadge.addEventListener('click', showFrontPage);
  }

  // Prototype Modal Controls
  const prototypeModal = document.getElementById('prototypeModal');
  const closePrototypeBtn = document.getElementById('closePrototypeBtn');
  const closePrototypeBottomBtn = document.getElementById('closePrototypeBottomBtn');

  const openPrototypeModal = () => {
    if (prototypeModal) prototypeModal.style.display = 'flex';
  };

  const closePrototypeModal = () => {
    if (prototypeModal) prototypeModal.style.display = 'none';
  };

  const protoTriggers = [
    document.getElementById('frontSeePrototypeBtn'),
    document.getElementById('frontInspectProtoBtn'),
    document.getElementById('viewPrototypeModalTrigger')
  ];

  protoTriggers.forEach(btn => {
    if (btn) btn.addEventListener('click', openPrototypeModal);
  });

  if (closePrototypeBtn) closePrototypeBtn.addEventListener('click', closePrototypeModal);
  if (closePrototypeBottomBtn) closePrototypeBottomBtn.addEventListener('click', closePrototypeModal);

  if (prototypeModal) {
    prototypeModal.addEventListener('click', (e) => {
      if (e.target === prototypeModal) closePrototypeModal();
    });
  }
}

// ============================================================================
// Initialization
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  if (elements.langSelector && elements.langSelector.value) {
    state.language = elements.langSelector.value;
  }

  const langObj = ALL_LANGUAGES.find(l => l.code === state.language);
  const langName = langObj ? langObj.name : state.language;
  if (elements.langToggleBtn) {
    elements.langToggleBtn.setAttribute('title', `Current Language: ${langName} (Tap to Change)`);
  }

  checkMobileEnvironment();
  setupEventListeners();
  renderLanguageModal();
  initFrontPageModule();
  drawVisualizer();

  initSpeechRecognition();
  startWatchdog();
});
