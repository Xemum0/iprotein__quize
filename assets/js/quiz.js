(function () {
  const GENDER_KEY = "iproteinPreferredGender";
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

      setActiveStep = (name) => {
        if (!name) return;
        const target = steps.find((step) => step.dataset.step === name);
        if (!target || target === activeStep) return;

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
      };
    }
  }

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
      const gender = (button.dataset.genderOption || "").toLowerCase();
      if (gender) {
        safeSession.set(GENDER_KEY, gender);
      }

      const nextUrl = button.dataset.nextUrl;
      if (nextUrl) {
        window.location.assign(nextUrl);
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
    const params = new URLSearchParams(window.location.search);
    const queryGender = (params.get("gender") || "").toLowerCase();
    const storedGender = (safeSession.get(GENDER_KEY) || "").toLowerCase();
    const fallbackGender = (
      genderRoot.dataset.defaultGender || "male"
    ).toLowerCase();

    const resolveGender = (value) =>
      value === "female" ? "female" : value === "male" ? "male" : null;

    const gender =
      resolveGender(queryGender) ??
      resolveGender(storedGender) ??
      resolveGender(fallbackGender) ??
      "male";

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
    }
  }
})();
