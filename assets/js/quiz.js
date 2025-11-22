(function () {
  const GENDER_KEY = "iproteinPreferredGender";
  const QUIZ_STATE_KEY = "iproteinQuizState";
  const GENDER_CONTENT = {
    male: {
      figure: "../assets/images/male1.svg",
      figureAlt: "متدرب من iProtein",
      headline: "أدخل اسمك لنخصص لك التجربة بما يناسبك",
      placeholder: "الاسم",
    },
    female: {
      figure: "../assets/images/female1.svg",
      figureAlt: "متدربة من iProtein",
      headline: "أدخلي اسمك لنخصص لك التجربة بما يناسبك",
      placeholder: "الاسم",
    },
  };
  const WEIGHT_CATEGORIES = [
    {
      index: 0,
      label: "45-59 كغ",
      display: "45 كغ",
      range: "45-59",
      male: "../assets/images/question4/man1.svg",
      female: "../assets/images/question4/female1.svg",
    },
    {
      index: 1,
      label: "60-74 كغ",
      display: "60 كغ",
      range: "60-74",
      male: "../assets/images/question4/man2.svg",
      female: "../assets/images/question4/female2.svg",
    },
    {
      index: 2,
      label: "75-99 كغ",
      display: "80 كغ",
      range: "75-99",
      male: "../assets/images/question4/man3.svg",
      female: "../assets/images/question4/female3.svg",
    },
    {
      index: 3,
      label: "100-129 كغ",
      display: "110 كغ",
      range: "100-129",
      male: "../assets/images/question4/man4.svg",
      female: "../assets/images/question4/female4.svg",
    },
    {
      index: 4,
      label: "130+ كغ",
      display: "150+ كغ",
      range: "130+",
      male: "../assets/images/question4/man5.svg",
      female: "../assets/images/question4/female5.svg",
    },
  ];

  const normalizeGender = (value) => {
    const lowercase = (value || "").toLowerCase();
    return lowercase === "female" ? "female" : lowercase === "male" ? "male" : null;
  };

  const safeSession = {
    get(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch (error) {
        /* noop */
      }
    },
  };

  const persistentStorage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        /* noop */
      }
    },
  };

  const generateSessionId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      try {
        return window.crypto.randomUUID();
      } catch (error) {
        /* ignore and fallback */
      }
    }
    const random = Math.random().toString(16).slice(2);
    return `session-${Date.now()}-${random}`;
  };

  const ensureAnswersObject = (value) =>
    value && typeof value === "object" ? value : {};

  const ensureQuizStateShape = (value) => {
    if (!value || typeof value !== "object") {
      return { answers: {} };
    }
    return { ...value, answers: ensureAnswersObject(value.answers) };
  };

  const readQuizState = () => {
    const raw = persistentStorage.get(QUIZ_STATE_KEY);
    if (!raw) return { answers: {} };
    try {
      const parsed = JSON.parse(raw);
      return ensureQuizStateShape(parsed);
    } catch (error) {
      return { answers: {} };
    }
  };

  const writeQuizState = (state) => {
    const safeState = ensureQuizStateShape(state);
    persistentStorage.set(QUIZ_STATE_KEY, JSON.stringify(safeState));
  };

  const updateQuizState = (updater) => {
    const current = readQuizState();
    let next =
      typeof updater === "function"
        ? updater({ ...current })
        : { ...current, ...(updater || {}) };

    if (!next) {
      next = current;
    }

    writeQuizState(next);
    return next;
  };

  const ensureSessionId = () => {
    const state = readQuizState();
    if (state.sessionId) return state.sessionId;
    const sessionId = generateSessionId();
    writeQuizState({ ...state, sessionId });
    return sessionId;
  };

  ensureSessionId();

  const attributeNameToKey = (name) => {
    const normalized = (name || "").replace(/^data-/, "");
    return normalized.replace(/-([a-z0-9])/gi, (_, char) =>
      char ? char.toUpperCase() : ""
    );
  };

  const sanitizeText = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  const safeCssEscape = (value) => {
    const stringValue = String(value);
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(stringValue);
    }
    return stringValue.replace(/"/g, '\\"');
  };

  const normalizeAnswerPayload = (payload) => {
    if (!payload) return null;
    const key = payload.answerKey || "value";
    const toArray = (value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    let rawValue =
      payload.rawValue != null
        ? String(payload.rawValue)
        : payload.value != null
        ? Array.isArray(payload.value)
          ? payload.value.join(",")
          : String(payload.value)
        : "";
    rawValue = rawValue.trim();

    let value = payload.value;
    if (value == null) {
      if (!rawValue) {
        value = null;
      } else if (rawValue.includes(",")) {
        value = toArray(rawValue);
      } else {
        value = rawValue;
      }
    } else if (typeof value === "string") {
      value = value.trim();
    } else if (Array.isArray(value)) {
      value = value
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => {
          if (typeof item === "string") return Boolean(item);
          return item != null;
        });
    }

    const isEmptyString = typeof value === "string" && !value;
    const isEmptyArray = Array.isArray(value) && value.length === 0;
    if (value == null || isEmptyString || isEmptyArray) {
      return null;
    }

    const normalizedRaw =
      rawValue || (Array.isArray(value) ? value.join(",") : String(value));

    return {
      answerKey: key,
      rawValue: normalizedRaw,
      value,
      type: payload.type || (Array.isArray(value) ? "multi-select" : "single"),
      sourceAttribute: payload.sourceAttribute || null,
      meta: payload.meta || null,
      questionText: sanitizeText(payload.questionText || ""),
      answerText: sanitizeText(
        payload.answerText ||
          (Array.isArray(value) ? value.join("، ") : normalizedRaw)
      ),
    };
  };

  const collectElementsWithAttrSuffix = (root, suffixes) => {
    if (!root || !suffixes || !suffixes.length) return [];
    const elements = [];
    const nodes = root.querySelectorAll ? Array.from(root.querySelectorAll("*")) : [];
    const allNodes = root.nodeType === 1 ? [root, ...nodes] : nodes;
    allNodes.forEach((node) => {
      if (!node.attributes) return;
      Array.from(node.attributes).forEach((attr) => {
        if (!attr.name.startsWith("data-")) return;
        if (suffixes.some((suffix) => attr.name.endsWith(suffix))) {
          elements.push({ element: node, attrName: attr.name });
        }
      });
    });
    return elements;
  };

  const findDataAttributeBySuffix = (root, suffixes) => {
    const matches = collectElementsWithAttrSuffix(root, suffixes);
    return matches.length ? matches[0].attrName : null;
  };

  const findTextByAttrSuffix = (root, suffixes) => {
    const matches = collectElementsWithAttrSuffix(root, suffixes);
    for (const match of matches) {
      const text = sanitizeText(match.element.textContent);
      if (text) return text;
    }
    return "";
  };

  const findTextBySelectors = (root, selectors) => {
    if (!root || !selectors || !selectors.length) return "";
    for (const selector of selectors) {
      if (!selector) continue;
      let element = null;
      if (root.matches && root.matches(selector)) {
        element = root;
      } else if (root.querySelector) {
        element = root.querySelector(selector);
      }
      if (!element) continue;
      const text = sanitizeText(element.textContent);
      if (text) return text;
    }
    return "";
  };

  const QUESTION_ATTR_SUFFIXES = ["-question", "-title", "-headline", "-label"];
  const QUESTION_SELECTOR_CANDIDATES = [
    "[data-question-title]",
    "[data-question-text]",
    "[data-question-heading]",
    "[data-question-label]",
    "[data-question]",
    "h1",
    "h2",
    "h3",
    ".question-title",
    ".text-wrapper-3",
    ".text-wrapper-5",
  ];

  const resolveQuestionText = (contextElement) => {
    const scopes = [];
    if (contextElement) {
      scopes.push(contextElement);
      const ancestor =
        contextElement.closest && contextElement.closest("[data-question-number]");
      if (ancestor && ancestor !== contextElement) {
        scopes.push(ancestor);
      }
    }
    const defaultScope =
      document.querySelector("[data-question-number]") ||
      document.querySelector("[data-question]") ||
      document.body;
    if (defaultScope && !scopes.includes(defaultScope)) {
      scopes.push(defaultScope);
    }
    if (!scopes.includes(document.body) && document.body) {
      scopes.push(document.body);
    }

    for (const scope of scopes) {
      const directText = findTextBySelectors(scope, QUESTION_SELECTOR_CANDIDATES);
      if (directText) return directText;
      const attrText = findTextByAttrSuffix(scope, QUESTION_ATTR_SUFFIXES);
      if (attrText) return attrText;
    }
    return "";
  };

  const widgetMetadata = new WeakMap();

  const deriveOptionLabel = (option) => {
    if (!option) return "";
    const LABEL_SELECTORS = [
      "[data-option-label]",
      ".option-label",
      ".button-2",
      ".text-wrapper-3",
      "label",
    ];
    const directText = sanitizeText(option.textContent);
    for (const selector of LABEL_SELECTORS) {
      const target =
        option.matches && option.matches(selector)
          ? option
          : option.querySelector
          ? option.querySelector(selector)
          : null;
      if (!target) continue;
      const text = sanitizeText(target.textContent);
      if (text) return text;
    }
    return directText;
  };

  const analyzeWidget = (widget) => {
    if (!widget) return null;
    const cached = widgetMetadata.get(widget);
    if (cached) return cached;

    const metadata = {
      widgetAttr: findDataAttributeBySuffix(widget, ["-widget"]),
      optionAttr: findDataAttributeBySuffix(widget, ["-option"]),
      questionText: resolveQuestionText(widget),
      valueDisplayAttr: findDataAttributeBySuffix(widget, [
        "-display",
        "-value-label",
        "-label",
        "-indicator",
        "-text",
      ]),
      inputElement: widget.querySelector
        ? widget.querySelector("input, textarea, select")
        : null,
    };

    if (metadata.valueDisplayAttr && widget.querySelector) {
      metadata.valueDisplayElement = widget.querySelector(
        `[${metadata.valueDisplayAttr}]`
      );
    } else {
      metadata.valueDisplayElement = null;
    }

    widgetMetadata.set(widget, metadata);
    return metadata;
  };

  const deriveWidgetAnswerText = (widget, metadata, rawValue) => {
    if (!widget || !rawValue) return "";
    metadata = metadata || analyzeWidget(widget);
    const tokens = String(rawValue)
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    if (metadata && metadata.optionAttr && tokens.length) {
      const labels = tokens
        .map((token) => {
          const selector = `[${metadata.optionAttr}="${safeCssEscape(token)}"]`;
          const option = widget.querySelector ? widget.querySelector(selector) : null;
          if (!option) return "";
          return deriveOptionLabel(option);
        })
        .filter(Boolean);
      if (labels.length) {
        return labels.join(labels.length > 1 ? "، " : "");
      }
    }

    if (metadata && metadata.inputElement) {
      const value = sanitizeText(metadata.inputElement.value);
      if (value) return value;
    }

    if (metadata && metadata.valueDisplayElement) {
      const value = sanitizeText(metadata.valueDisplayElement.textContent);
      if (value) return value;
    }

    if (tokens.length) {
      return tokens.join(tokens.length > 1 ? "، " : "");
    }

    return sanitizeText(rawValue);
  };

  const computeResumePage = (questionNumber) => {
    if (!Number.isFinite(questionNumber)) return null;
    const targetPage = questionNumber + 2;
    if (targetPage < 2) return 2;
    if (targetPage > 49) return 49;
    return targetPage;
  };

  const getPageInfo = (() => {
    let cache = null;
    return () => {
      if (cache) return cache;
      const filename = (window.location.pathname.split("/").pop() || "").toLowerCase();
      const match = filename.match(/^(quize)(\d+)\.html$/i);
      if (!match) {
        cache = { pageId: null, pageNumber: null, questionNumber: null };
        return cache;
      }
      const pageNumber = Number(match[2]);
      cache = {
        pageId: match[1].toLowerCase() + match[2],
        pageNumber,
        questionNumber:
          Number.isFinite(pageNumber) && pageNumber > 1 ? pageNumber - 1 : 0,
      };
      return cache;
    };
  })();

  const persistAnswer = (questionId, payload) => {
    if (!questionId) return;
    const pageInfo = getPageInfo();
    updateQuizState((state) => {
      const answers = { ...ensureAnswersObject(state.answers) };
      const normalized = normalizeAnswerPayload(payload);
      if (!normalized) {
        delete answers[questionId];
        return { ...state, answers };
      }

      const contextElement =
        payload && payload.contextElement ? payload.contextElement : null;
      const questionText =
        normalized.questionText ||
        resolveQuestionText(contextElement || null) ||
        (answers[questionId] && answers[questionId].questionText) ||
        "";
      const metadata = contextElement ? analyzeWidget(contextElement) : null;
      let answerText =
        normalized.answerText ||
        (contextElement
          ? deriveWidgetAnswerText(contextElement, metadata, normalized.rawValue)
          : null) ||
        (Array.isArray(normalized.value)
          ? normalized.value.join("، ")
          : normalized.rawValue);
      answerText = sanitizeText(answerText);

      answers[questionId] = {
        ...(answers[questionId] || {}),
        ...normalized,
        questionText,
        answerText,
        questionId,
        questionNumber: pageInfo.questionNumber,
        pageNumber: pageInfo.pageNumber,
        updatedAt: new Date().toISOString(),
      };

      let nextState = {
        ...state,
        answers,
        lastQuestion: Math.max(
          Number(state.lastQuestion) || 0,
          Number(pageInfo.questionNumber) || 0
        ),
      };

      const resumePage = computeResumePage(pageInfo.questionNumber);
      if (resumePage) {
        const currentResume = Number(state.resumePage) || 0;
        const nextResume = Math.max(currentResume, resumePage);
        nextState = { ...nextState, resumePage: nextResume };
        if (nextResume >= 49) {
          nextState.quizCompleted = true;
        }
      }

      return nextState;
    });
  };

  const getLocationGender = () =>
    normalizeGender(new URLSearchParams(window.location.search).get("gender"));

  const ensureFemaleQueryParam = () => {
    if (getLocationGender() === "female") return;
    const storedGender = normalizeGender(readQuizState().gender);
    if (storedGender !== "female") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("gender", "female");
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      /* noop */
    }
  };

  ensureFemaleQueryParam();

  const syncGenderQueryForLinks = () => {
    if (getLocationGender() !== "female") return;

    const shouldSkip = (href) => {
      if (!href) return true;
      const trimmed = href.trim();
      if (!trimmed || trimmed === "#" || trimmed.startsWith("#")) return true;
      if (/^(?:mailto:|tel:|javascript:)/i.test(trimmed)) return true;
      try {
        const url = new URL(trimmed, window.location.href);
        if (url.origin !== window.location.origin) return true;
        return !url.pathname.toLowerCase().includes("quize");
      } catch {
        return true;
      }
    };

    const toRelativeHref = (url) => `${url.pathname}${url.search}${url.hash}`;

    document.querySelectorAll("a[href]").forEach((link) => {
      if (link.dataset.skipGenderSync != null) return;
      const href = link.getAttribute("href");
      if (shouldSkip(href)) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      url.searchParams.set("gender", "female");
      link.setAttribute("href", toRelativeHref(url));
    });
  };

  syncGenderQueryForLinks();

  const maybeResumeFromSavedState = () => {
    const pageInfo = getPageInfo();
    if (!pageInfo.pageNumber || pageInfo.pageNumber > 2) return;
    const state = readQuizState();
    const resumePage = Number(state.resumePage);
    if (!resumePage || resumePage <= pageInfo.pageNumber) return;
    if (resumePage < 2 || resumePage > 49) return;

    const destination = new URL(`./quize${resumePage}.html`, window.location.href);
    const preferredGender = getLocationGender() || normalizeGender(state.gender);
    if (preferredGender === "female") {
      destination.searchParams.set("gender", "female");
    } else {
      destination.searchParams.delete("gender");
    }
    window.location.replace(destination.toString());
  };

  maybeResumeFromSavedState();

  const currentPageInfo = getPageInfo();
  const currentQuestionId = currentPageInfo.pageId;

  const getActiveGender = (fallbackGender) =>
    getLocationGender() ||
    normalizeGender(readQuizState().gender) ||
    normalizeGender(safeSession.get(GENDER_KEY)) ||
    normalizeGender(fallbackGender) ||
    null;

  const runStepScripts = (stepName) => {
    if (!stepName) return;
    document.querySelectorAll(`[data-step-script="${stepName}"]`).forEach((script) => {
      if (script.dataset.scriptExecuted === "true") return;
      const code = script.textContent || "";
      if (!code.trim()) {
        script.dataset.scriptExecuted = "true";
        return;
      }
      try {
        new Function(code)();
      } catch (error) {
        console.error("Failed to run quiz step script:", stepName, error);
      }
      script.dataset.scriptExecuted = "true";
    });
  };

  const app = document.querySelector(".quiz-app");
  let setActiveStep = null;

  if (app) {
    const steps = Array.from(app.querySelectorAll(".quiz-step"));
    if (steps.length) {
      let activeStep =
        steps.find((step) => step.classList.contains("is-active")) || steps[0];

      steps.forEach((step) => {
        step.setAttribute("aria-hidden", step === activeStep ? "false" : "true");
      });
      runStepScripts(activeStep.dataset.step);

      setActiveStep = (name) => {
        if (!name) return false;
        const target = steps.find((step) => step.dataset.step === name);
        if (!target || target === activeStep) return false;

        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        activeStep.setAttribute("aria-hidden", "true");
        if (!prefersReducedMotion) {
          activeStep.classList.add("is-exiting");
          setTimeout(() => {
            activeStep.classList.remove("is-exiting");
          }, 320);
        } else {
          activeStep.classList.remove("is-exiting");
        }
        activeStep.classList.remove("is-active");

        target.classList.add("is-active");
        target.setAttribute("aria-hidden", "false");
        activeStep = target;
        app.setAttribute("data-active-step", name);
        runStepScripts(name);
        return true;
      };
    }
  }

  const quizStepPattern = /^(quize\d+)\.html$/i;

  const extractQuizStep = (value) => {
    if (!value) return null;
    let url;
    try {
      url = new URL(value, window.location.href);
    } catch (error) {
      return null;
    }

    const filename = (url.pathname.split("/").pop() || "").toLowerCase();
    const match = filename.match(quizStepPattern);
    return match ? match[1] : null;
  };

  const updateUrlSearchFromValue = (value) => {
    if (!value) return;
    let url;
    try {
      url = new URL(value, window.location.href);
    } catch (error) {
      return;
    }

    const current = new URL(window.location.href);
    const nextSearch = url.search || "";
    if (current.search === nextSearch) return;
    current.search = nextSearch;
    window.history.replaceState({}, "", current.toString());
  };

  const navigateWithinQuiz = (value) => {
    if (!value || !setActiveStep) return false;
    const targetStep = extractQuizStep(value);
    if (!targetStep) return false;

    const navigated = setActiveStep(targetStep);
    if (!navigated) return false;

    updateUrlSearchFromValue(value);
    syncGenderQueryForLinks();
    return true;
  };

  if (setActiveStep) {
    document.querySelectorAll("[data-step-target]").forEach((trigger) => {
      if (trigger.hasAttribute("data-gender-option")) return;
      trigger.addEventListener("click", (event) => {
        const targetName = trigger.getAttribute("data-step-target");
        if (targetName) {
          event.preventDefault();
          setActiveStep(targetName);
        }
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (!setActiveStep) return;
    const link = event.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    const href = link.getAttribute("href");
    if (navigateWithinQuiz(href)) {
      event.preventDefault();
    }
  });

  document.querySelectorAll('[data-animate="pulse"]').forEach((button) => {
    const resetAnimation = () => button.classList.remove("is-animating");
    button.addEventListener("animationend", resetAnimation);
    button.addEventListener("click", () => {
      resetAnimation();
      // force reflow to restart animation
      void button.offsetWidth;
      button.classList.add("is-animating");
    });
  });

  const genderButtons = document.querySelectorAll("[data-gender-option]");
  genderButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const gender = normalizeGender(button.dataset.genderOption);
      if (gender) {
        safeSession.set(GENDER_KEY, gender);
        updateQuizState((state) => {
          const last = Number(state.lastQuestion) || 0;
          return {
            ...state,
            gender,
            lastQuestion: Math.max(last, 1),
          };
        });
        if (currentQuestionId) {
          const questionText = resolveQuestionText(
            button.closest("[data-question-number]") || button.closest(".frame-6")
          );
          const answerText = sanitizeText(button.textContent || "");
          persistAnswer(currentQuestionId, {
            answerKey: "gender",
            rawValue: gender,
            type: "single",
            questionText,
            answerText,
            contextElement: button,
          });
        }
      }

      const nextUrl = button.dataset.nextUrl;
      if (nextUrl) {
        if (!navigateWithinQuiz(nextUrl)) {
          window.location.assign(nextUrl);
        }
        return;
      }

      const stepTarget = button.dataset.stepTarget;
      if (setActiveStep && stepTarget) {
        setActiveStep(stepTarget);
      }
    });
  });

  document
    .querySelectorAll("[data-prevent-submit]")
    .forEach((form) =>
      form.addEventListener("submit", (event) => event.preventDefault())
    );

  const genderRoot = document.querySelector("[data-gender-context]");
  if (genderRoot) {
    const gender = getActiveGender(genderRoot.dataset.defaultGender) || "male";

    updateQuizState((state) => ({ ...state, gender }));
    safeSession.set(GENDER_KEY, gender);

    const content = GENDER_CONTENT[gender];
    const figure = genderRoot.querySelector("[data-gender-figure]");
    if (figure && content.figure) {
      figure.setAttribute("src", content.figure);
      figure.setAttribute("alt", content.figureAlt || "");
    }

    const headline = genderRoot.querySelector("[data-gender-headline]");
    if (headline && content.headline) {
      headline.textContent = content.headline;
    }

    const input = genderRoot.querySelector("[data-gender-input]");
    if (input) {
      if (content.placeholder) {
        input.setAttribute("placeholder", content.placeholder);
      }
      input.setAttribute("aria-label", "ما اسمك الكامل؟");
      const savedName = (readQuizState().fullName || "").trim();
      if (savedName) {
        input.value = savedName;
      }
    }
  }

  const quizNameForm = document.querySelector("[data-name-step]");
  if (quizNameForm) {
    const input = quizNameForm.querySelector("[data-gender-input]");
    const submitButton = quizNameForm.querySelector("[data-name-submit]");

    const resolveNextGender = () => getActiveGender("male") || "male";

    const clearError = () => {
      if (!input) return;
      input.removeAttribute("aria-invalid");
      input.classList.remove("has-error");
    };

    if (input) {
      input.addEventListener("input", clearError);
    }

    const handleNameSubmit = () => {
      if (!input) return;
      const fullName = input.value.trim();
      if (!fullName) {
        input.setAttribute("aria-invalid", "true");
        input.classList.add("has-error");
        input.focus();
        return;
      }

      clearError();
      const gender = resolveNextGender();

      updateQuizState((state) => {
        const last = Number(state.lastQuestion) || 0;
        return {
          ...state,
          fullName,
          gender,
          lastQuestion: Math.max(last, 2),
        };
      });
      safeSession.set(GENDER_KEY, gender);

      if (currentQuestionId) {
        const questionText = resolveQuestionText(quizNameForm);
        persistAnswer(currentQuestionId, {
          answerKey: "fullName",
          rawValue: fullName,
          type: "text",
          questionText,
          answerText: fullName,
          contextElement: quizNameForm,
        });
      }

      const nextUrl =
        (submitButton && submitButton.dataset.nextUrl) || "./quize4.html";
      const destination = new URL(nextUrl, window.location.href);
      destination.searchParams.set("gender", gender);
      const finalUrl = destination.toString();
      if (!navigateWithinQuiz(finalUrl)) {
        window.location.assign(finalUrl);
      }
    };

    quizNameForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleNameSubmit();
    });

    if (submitButton) {
      submitButton.addEventListener("click", (event) => {
        event.preventDefault();
        handleNameSubmit();
      });
    }
  }

  const ageFigures = document.querySelectorAll("[data-age-figure]");
  if (ageFigures.length) {
    const gender = getActiveGender("male") || "male";
    ageFigures.forEach((figure) => {
      const maleSrc = figure.getAttribute("data-male-src");
      const femaleSrc = figure.getAttribute("data-female-src");
      const nextSrc =
        gender === "female" ? femaleSrc || maleSrc : maleSrc || femaleSrc;
      if (nextSrc) {
        figure.setAttribute("src", nextSrc);
      }
    });
  }

  const ageOptionButtons = document.querySelectorAll("[data-age-value]");
  if (ageOptionButtons.length) {
    const updateVisualState = (selectedValue) => {
      document.querySelectorAll("[data-age-card]").forEach((card) => {
        const button = card.querySelector("[data-age-value]");
        const buttonValue = button ? button.dataset.ageValue : null;
        const isSelected = Boolean(selectedValue) && buttonValue === selectedValue;
        card.classList.toggle("is-selected", isSelected);
        if (button) {
          button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        }
      });
    };

    const currentSelection = (readQuizState().ageRange || "").trim();
    updateVisualState(currentSelection);

    ageOptionButtons.forEach((button) => {
      if (!button.hasAttribute("aria-pressed")) {
        button.setAttribute("aria-pressed", "false");
      }

      button.addEventListener("click", () => {
        const value = (button.dataset.ageValue || "").trim();
        if (!value) return;

        updateVisualState(value);
        const gender = getActiveGender("male") || "male";

        updateQuizState((state) => {
          const last = Number(state.lastQuestion) || 0;
          return {
            ...state,
            ageRange: value,
            gender: state.gender || gender,
            lastQuestion: Math.max(last, 3),
          };
        });
        safeSession.set(GENDER_KEY, gender);

        if (currentQuestionId) {
          const questionText = resolveQuestionText(
            button.closest("[data-question-number]") ||
              button.closest("[data-age-card]") ||
              document.body
          );
          const answerText = sanitizeText(button.textContent || value);
          persistAnswer(currentQuestionId, {
            answerKey: "ageRange",
            rawValue: value,
            type: "single",
            questionText,
            answerText,
            contextElement: button,
          });
        }

        const nextUrl = button.dataset.nextUrl || "./quize5.html";
        const destination = new URL(nextUrl, window.location.href);
        destination.searchParams.set("gender", gender);
        const finalUrl = destination.toString();
        if (!navigateWithinQuiz(finalUrl)) {
          window.location.assign(finalUrl);
        }
      });
    });
  }

  const weightRoot = document.querySelector("[data-weight-question]");
  if (weightRoot) {
    const figure = weightRoot.querySelector("[data-weight-figure]");
    const display = weightRoot.querySelector("[data-weight-display]");
    const picker = weightRoot.querySelector("[data-weight-picker]");
    const strip = picker ? picker.querySelector("[data-weight-strip]") : null;
    const minus = picker ? picker.querySelector("[data-weight-minus]") : null;
    const plus = picker ? picker.querySelector("[data-weight-plus]") : null;
    const nextButton = weightRoot.querySelector("[data-weight-next]");

    if (!strip) return;

    const MIN_WEIGHT = 45;
    const MAX_WEIGHT = 150;

    const clampWeight = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return MIN_WEIGHT;
      return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(numeric)));
    };

    const resolveCategory = (value) => {
      if (value <= 59) return WEIGHT_CATEGORIES[0];
      if (value <= 74) return WEIGHT_CATEGORIES[1];
      if (value <= 99) return WEIGHT_CATEGORIES[2];
      if (value <= 129) return WEIGHT_CATEGORIES[3];
      return WEIGHT_CATEGORIES[4];
    };

    if (!strip.children.length) {
      for (let value = MIN_WEIGHT; value <= MAX_WEIGHT; value += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "weight-picker-weight";
        button.dataset.weightValue = String(value);
        button.textContent = value.toString();
        strip.appendChild(button);
      }
    }

    const getWeightItems = () =>
      Array.from(strip.querySelectorAll("[data-weight-value]"));

    let suppressScrollUpdate = false;
    let scrollTimeout;

    const scrollToWeight = (value, behavior = "instant") => {
      const target = strip.querySelector(`[data-weight-value="${value}"]`);
      if (!target) return;
      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      const scrollLeft = targetCenter - strip.clientWidth / 2;
      suppressScrollUpdate = true;
      strip.scrollTo({ left: scrollLeft, behavior });
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        suppressScrollUpdate = false;
      }, 120);
    };

    const applyUI = (value, category, gender) => {
      getWeightItems().forEach((item) => {
        const isActive = Number(item.dataset.weightValue) === value;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      if (display) {
        display.textContent = `${value} كغ`;
      }

      if (figure) {
        const src = gender === "female" ? category.female : category.male;
        if (src) {
          figure.setAttribute("src", src);
          figure.setAttribute("alt", `جسم لفئة وزن ${category.label}`);
        }
      }
    };

    const persistSelection = (value, category, gender) => {
      updateQuizState((state) => {
        const last = Number(state.lastQuestion) || 0;
        return {
          ...state,
          gender: state.gender || gender,
          weightSelection: {
            value,
            categoryIndex: category.index,
            label: category.label,
            range: category.range,
          },
          lastQuestion: Math.max(last, 4),
        };
      });
      safeSession.set(GENDER_KEY, gender);

      if (currentQuestionId) {
        const questionText = resolveQuestionText(weightRoot);
        const labelParts = [category?.label, category?.range]
          .filter(Boolean)
          .join(" - ");
        const answerLabel = labelParts
          ? `${value} كغ (${labelParts})`
          : `${value} كغ`;
        persistAnswer(currentQuestionId, {
          answerKey: "weight",
          rawValue: String(value),
          type: "number",
          questionText,
          answerText: answerLabel,
          contextElement: weightRoot,
          meta: {
            label: category?.label,
            range: category?.range,
          },
        });
      }
    };

    const setWeight = (value, { skipScroll = false } = {}) => {
      const clamped = clampWeight(value);
      const gender = getActiveGender("male") || "male";
      const category = resolveCategory(clamped);
      applyUI(clamped, category, gender);
      persistSelection(clamped, category, gender);
      currentWeight = clamped;
      if (!skipScroll) {
        scrollToWeight(clamped);
      }
    };

    const findNearestWeight = () => {
      const items = getWeightItems();
      if (!items.length) return currentWeight;
      const stripRect = strip.getBoundingClientRect();
      const centerX = stripRect.left + stripRect.width / 2;
      let closestValue = currentWeight;
      let minDist = Infinity;

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        const dist = Math.abs(mid - centerX);
        if (dist < minDist) {
          minDist = dist;
          closestValue = Number(item.dataset.weightValue);
        }
      });

      return closestValue;
    };

    const quizState = readQuizState();
    const savedWeight =
      (quizState.weightSelection && quizState.weightSelection.value != null
        ? quizState.weightSelection.value
        : quizState.weightSelectionValue != null
        ? quizState.weightSelectionValue
        : quizState.weightValue != null
        ? quizState.weightValue
        : MIN_WEIGHT);

    let currentWeight = clampWeight(savedWeight);

    getWeightItems().forEach((item) => {
      item.addEventListener("click", () => {
        const value = Number(item.dataset.weightValue);
        scrollToWeight(value);
        setWeight(value, { skipScroll: true });
      });
    });

    if (minus) {
      minus.addEventListener("click", () => {
        const nextValue = clampWeight(currentWeight - 1);
        scrollToWeight(nextValue);
        setWeight(nextValue, { skipScroll: true });
      });
    }

    if (plus) {
      plus.addEventListener("click", () => {
        const nextValue = clampWeight(currentWeight + 1);
        scrollToWeight(nextValue);
        setWeight(nextValue, { skipScroll: true });
      });
    }

    strip.addEventListener("scroll", () => {
      if (suppressScrollUpdate) return;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const nearest = findNearestWeight();
        if (nearest !== currentWeight) {
          setWeight(nearest, { skipScroll: true });
        } else {
          // ensure UI sync if same value
          const gender = getActiveGender("male") || "male";
          applyUI(nearest, resolveCategory(nearest), gender);
        }
      }, 80);
    });

    requestAnimationFrame(() => {
      scrollToWeight(currentWeight, "auto");
      setWeight(currentWeight, { skipScroll: true });
    });

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        setWeight(currentWeight, { skipScroll: true });
        const gender = getActiveGender("male") || "male";
        const nextUrl = nextButton.dataset.nextUrl || "./quize6.html";
        const destination = new URL(nextUrl, window.location.href);
        destination.searchParams.set("gender", gender);
        const finalUrl = destination.toString();
        if (!navigateWithinQuiz(finalUrl)) {
          window.location.assign(finalUrl);
        }
      });
    }
  }
  const connectHeightWidget = () => {
    const widget = document.querySelector("[data-height-widget]");
    if (!widget) return;
    const output = widget.querySelector("[data-height-label]");
    if (!output) return;

    const syncHeight = () => {
      const text = output.textContent || "";
      const match = text.match(/(\d+)/);
      if (!match) return;
      widget.dataset.heightValue = match[1];
    };

    syncHeight();
    const observer = new MutationObserver(syncHeight);
    observer.observe(output, { childList: true, subtree: true, characterData: true });
  };

  const connectBodyfatWidget = () => {
    const widget = document.querySelector("[data-bodyfat-widget]");
    if (!widget) return;
    const indicator = widget.querySelector("[data-bodyfat-indicator]");
    const slider = widget.querySelector("[data-bodyfat-slider]");

    const syncValue = (value) => {
      if (!value) return;
      widget.dataset.bodyfatValue = String(value);
    };

    if (slider) {
      const handleSlider = () => syncValue(slider.value);
      slider.addEventListener("input", handleSlider);
      handleSlider();
    }

    if (indicator) {
      const syncFromIndicator = () => {
        const text = indicator.textContent || "";
        const match = text.match(/(\d+)/);
        if (!match) return;
        syncValue(match[1]);
      };
      syncFromIndicator();
      const observer = new MutationObserver(syncFromIndicator);
      observer.observe(indicator, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  };

  const connectContactWidget = () => {
    const widget = document.querySelector("[data-contact-widget]");
    if (!widget) return;
    const input = widget.querySelector("[data-contact-input]");
    if (!input) return;

    const syncValue = () => {
      widget.dataset.contactValue = input.value.trim();
    };

    input.addEventListener("input", syncValue);
    syncValue();
  };

  const attachContactValidation = () => {
    const widget = document.querySelector("[data-contact-widget]");
    if (!widget) return;
    const input = widget.querySelector("[data-contact-input]");
    if (!input) return;
    const actions = widget.querySelectorAll(".contact-actions .button, [data-contact-next]");
    if (!actions.length) return;

    const phoneRegion = (input.dataset.phoneRegion || "").toLowerCase();

    const normalizePhone = (value) =>
      (value || "").replace(/[\s\-()]/g, "").trim();

    const isIraqPhoneNumber = (value) => {
      if (!value) return false;
      let normalized = normalizePhone(value);
      if (!normalized) return false;
      if (normalized.startsWith("00")) {
        normalized = `+${normalized.slice(2)}`;
      }
      if (/^\+9647\d{9}$/.test(normalized)) return true;
      if (/^9647\d{9}$/.test(normalized)) return true;
      if (/^07\d{9}$/.test(normalized)) return true;
      return false;
    };

    const clearError = () => {
      input.removeAttribute("aria-invalid");
      input.classList.remove("has-error");
    };

    input.addEventListener("input", clearError);

    const isEmail = input.type === "email";
    const isPhone = input.type === "tel";

    const isValidValue = (value) => {
      if (!value) return false;
      if (isEmail) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      }
      if (isPhone) {
        if (phoneRegion === "iq") {
          return isIraqPhoneNumber(value);
        }
        return /^\+?\d[\d\s]{6,}$/.test(value);
      }
      return Boolean(value);
    };

    const focusError = () => {
      input.setAttribute("aria-invalid", "true");
      input.classList.add("has-error");
      input.focus();
    };

    actions.forEach((action) => {
      action.addEventListener("click", (event) => {
        const value = input.value.trim();
        if (!isValidValue(value)) {
          event.preventDefault();
          focusError();
        } else {
          clearError();
        }
      });
    });
  };

  const widgetObserverRegistry = new WeakSet();
  const initWidgetAnswerObservers = () => {
    if (!currentQuestionId) return;
    const widgets = [];
    document.querySelectorAll("*").forEach((element) => {
      const hasWidgetAttribute = Array.from(element.attributes).some(
        (attr) => attr.name.startsWith("data-") && attr.name.endsWith("-widget")
      );
      if (hasWidgetAttribute) {
        widgets.push(element);
      }
    });

    widgets.forEach((widget) => {
      if (widgetObserverRegistry.has(widget)) return;
      widgetObserverRegistry.add(widget);
      const metadata = analyzeWidget(widget);
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          const attr = mutation.attributeName || "";
          if (!attr.startsWith("data-")) return;
          if (attr.endsWith("-widget")) return;
          if (attr === "data-question-number") return;
          const value = widget.getAttribute(attr) || "";
          const answerKey = attributeNameToKey(attr);
          const questionText =
            (metadata && metadata.questionText) || resolveQuestionText(widget);
          const answerText = deriveWidgetAnswerText(widget, metadata, value);
          persistAnswer(currentQuestionId, {
            answerKey,
            rawValue: value,
            type: value.includes(",") ? "multi-select" : "single",
            sourceAttribute: attr,
            questionText,
            answerText,
            contextElement: widget,
          });
        });
      });
      observer.observe(widget, { attributes: true });
    });
  };

  initWidgetAnswerObservers();
  connectHeightWidget();
  connectBodyfatWidget();
  connectContactWidget();
  attachContactValidation();
})();
