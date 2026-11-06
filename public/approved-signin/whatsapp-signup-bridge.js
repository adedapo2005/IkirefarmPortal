(() => {
  "use strict";

  const AUTH_BASE = "/api/portal/v69/auth";
  const REGISTER_PATH = /\/approved-signin\/register\/?$/;
  let activeDialog = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const postAuth = async (path, payload) => {
    const response = await fetch(AUTH_BASE + "/" + path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.message || result.error || "AUTHENTICATION_FAILED");
      error.code = result.error || "";
      error.status = response.status;
      throw error;
    }
    return result;
  };

  const errorCopy = (error, phase) => {
    if (error?.code === "AUTH_CHALLENGE_RATE_LIMIT") {
      return "Too many attempts. Please wait before requesting another code.";
    }
    if (error?.code === "AUTHENTICATION_PROVIDER_UNAVAILABLE" || error?.status === 503) {
      return "WhatsApp registration is temporarily unavailable. Please try again later.";
    }
    if (error?.code === "SIGNUP_INPUT_INVALID") {
      return "Please check your details and complete every required field.";
    }
    if (error?.code === "AUTH_CHALLENGE_ATTEMPTS_EXCEEDED") {
      return "Too many incorrect codes. Start again to request a new verification code.";
    }
    if (error?.code === "AUTH_CHALLENGE_INVALID") {
      return "The verification code is incorrect or expired. Please check it and try again.";
    }
    if (error?.code === "ACCOUNT_CREATION_UNAVAILABLE") {
      return "We could not complete account creation. Please try again.";
    }
    return phase === "verify"
      ? "We could not verify that code. Please try again."
      : "We could not start WhatsApp registration. Please try again.";
  };

  const closeDialog = () => {
    if (!activeDialog) return;
    const { overlay, previousFocus, previousOverflow, onKeyDown } = activeDialog;
    document.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    activeDialog = null;
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
  };

  const openDialog = (trigger) => {
    if (activeDialog) return;

    const previousFocus = trigger || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const overlay = element("div", "gw-wa-signup-overlay");
    overlay.setAttribute("role", "presentation");

    const dialog = element("section", "gw-wa-signup-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "gw-wa-signup-title");
    dialog.setAttribute("aria-describedby", "gw-wa-signup-description");

    const header = element("header", "gw-wa-signup-header");
    const headingGroup = element("div", "gw-wa-signup-heading");
    headingGroup.append(
      element("p", "gw-wa-signup-eyebrow", "Secure Employee Access"),
      element("h2", "gw-wa-signup-title", "WhatsApp Sign-Up")
    );
    const closeButton = element("button", "gw-wa-signup-close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close WhatsApp Sign-Up");
    closeButton.addEventListener("click", closeDialog);
    header.append(headingGroup, closeButton);

    const description = element(
      "p",
      "gw-wa-signup-description",
      "Create your DAENEM Farms account and verify your phone number through WhatsApp."
    );
    description.id = "gw-wa-signup-description";

    const status = element("p", "gw-wa-signup-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;

    const form = element("form", "gw-wa-signup-form");
    form.noValidate = true;

    const state = {
      stage: "details",
      challengeId: "",
      payload: null,
      codeInput: null,
      busy: false
    };

    const field = (labelText, type, placeholder, autocomplete) => {
      const label = element("label", "gw-wa-signup-label");
      label.append(element("span", "gw-wa-signup-label-text", labelText));
      const input = element("input", "gw-wa-signup-field");
      input.type = type;
      input.placeholder = placeholder;
      input.autocomplete = autocomplete;
      input.required = true;
      input.setAttribute("aria-label", labelText);
      if (type === "tel") input.inputMode = "tel";
      if (type === "email") input.inputMode = "email";
      label.append(input);
      return { label, input };
    };

    const fullName = field("Full Name", "text", "Your Full Name", "name");
    const email = field("Email Address", "email", "you@example.com", "email");
    const phone = field("WhatsApp Number", "tel", "+234 801 234 5678", "tel");
    const password = field("Password", "password", "Create Password", "new-password");
    const confirmPassword = field("Confirm Password", "password", "Confirm Password", "new-password");

    const termsLabel = element("label", "gw-wa-signup-terms");
    const terms = element("input", "gw-wa-signup-checkbox");
    terms.type = "checkbox";
    terms.required = true;
    const termsText = element("span", "gw-wa-signup-terms-copy");
    termsText.append(document.createTextNode("I Agree To The "));
    const termsLink = element("a", "", "Terms & Conditions");
    termsLink.href = "/approved-signin/legal/terms.html";
    termsLink.target = "_blank";
    termsLink.rel = "noopener noreferrer";
    const andText = document.createTextNode(" And ");
    const privacyLink = element("a", "", "Privacy Policy");
    privacyLink.href = "/approved-signin/legal/privacy.html";
    privacyLink.target = "_blank";
    privacyLink.rel = "noopener noreferrer";
    termsText.append(termsLink, andText, privacyLink);
    termsLabel.append(terms, termsText);

    const submit = element("button", "gw-wa-signup-submit", "Send WhatsApp Verification Code");
    submit.type = "submit";

    const resend = element("button", "gw-wa-signup-secondary", "Resend Code");
    resend.type = "button";
    const changeDetails = element("button", "gw-wa-signup-secondary", "Change Details");
    changeDetails.type = "button";

    const maskPhone = (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length > 3 ? "ending in " + digits.slice(-4) : "your WhatsApp number";
    };

    const setStatus = (message, kind) => {
      status.textContent = message;
      status.hidden = !message;
      status.dataset.kind = kind || "info";
    };

    const setBusy = (busy) => {
      state.busy = busy;
      submit.disabled = busy;
      submit.textContent = busy
        ? "Please Wait..."
        : state.stage === "verify"
          ? "Verify & Create Account"
          : "Send WhatsApp Verification Code";
      resend.disabled = busy;
      changeDetails.disabled = busy;
    };

    const buildPayload = () => ({
      email: email.input.value.trim(),
      displayName: fullName.input.value.trim(),
      phone: phone.input.value.trim().replace(/[\s().-]/g, ""),
      password: password.input.value,
      department: "Farm Operations",
      jobTitle: "Employee",
      channel: "whatsapp",
      terms: terms.checked
    });

    const validDetails = (payload) => {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
      const phoneValid = /^\+[1-9]\d{6,14}$/.test(payload.phone);
      const passwordValid = payload.password.length >= 6 &&
        payload.password.length <= 200 &&
        /[A-Za-z]/.test(payload.password) &&
        /\d/.test(payload.password);
      if (payload.displayName.length < 2) return "Enter your full name.";
      if (!emailValid) return "Enter a valid email address.";
      if (!phoneValid) return "Enter your WhatsApp number in international format, including the + country code.";
      if (!passwordValid) return "Use a password with at least six characters, including a letter and a number.";
      if (payload.password !== confirmPassword.input.value) return "Your passwords do not match.";
      if (!payload.terms) return "Please accept the Terms & Conditions and Privacy Policy to continue.";
      return "";
    };

    const renderDetails = () => {
      state.stage = "details";
      state.challengeId = "";
      state.payload = null;
      state.codeInput = null;
      description.textContent = "Create your DAENEM Farms account and verify your phone number through WhatsApp.";
      form.replaceChildren(
        fullName.label,
        email.label,
        phone.label,
        password.label,
        confirmPassword.label,
        termsLabel,
        submit
      );
      setBusy(false);
    };

    const renderVerify = () => {
      state.stage = "verify";
      description.textContent = "If your details are eligible, a six-digit verification code will be sent to the WhatsApp number " + maskPhone(state.payload.phone) + ".";
      const hint = element(
        "p",
        "gw-wa-signup-hint",
        "Enter the six-digit code from WhatsApp. You do not need to enter any template variables."
      );
      const codeLabel = element("label", "gw-wa-signup-label");
      codeLabel.append(element("span", "gw-wa-signup-label-text", "WhatsApp Verification Code"));
      const codeInput = element("input", "gw-wa-signup-field gw-wa-signup-code");
      codeInput.type = "text";
      codeInput.inputMode = "numeric";
      codeInput.autocomplete = "one-time-code";
      codeInput.maxLength = 6;
      codeInput.pattern = "[0-9]{6}";
      codeInput.required = true;
      codeInput.placeholder = "000000";
      codeInput.setAttribute("aria-label", "Six-Digit WhatsApp Verification Code");
      codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
      });
      codeLabel.append(codeInput);
      state.codeInput = codeInput;

      const actions = element("div", "gw-wa-signup-actions");
      actions.append(resend, changeDetails);
      form.replaceChildren(hint, codeLabel, submit, actions);
      setBusy(false);
      codeInput.focus({ preventScroll: true });
    };

    const renderComplete = (message) => {
      state.stage = "complete";
      state.payload = null;
      state.codeInput = null;
      password.input.value = "";
      confirmPassword.input.value = "";
      description.textContent = message ||
        "Your WhatsApp number is verified. Your provisional account is awaiting Owner approval.";
      const completeButton = element("button", "gw-wa-signup-submit", "Continue To Sign In");
      completeButton.type = "button";
      completeButton.addEventListener("click", () => {
        window.location.assign("/approved-signin/");
      });
      form.replaceChildren(completeButton);
      setBusy(false);
    };

    const startChallenge = async (isResend) => {
      if (state.busy) return;
      setStatus("", "");
      if (!isResend) {
        state.payload = buildPayload();
        const invalid = validDetails(state.payload);
        if (invalid) {
          setStatus(invalid, "error");
          return;
        }
      }
      setBusy(true);
      try {
        const result = await postAuth("signup/start", state.payload);
        if (!result.challengeId) throw new Error("AUTH_CHALLENGE_INVALID");
        state.challengeId = result.challengeId;
        if (isResend && state.codeInput) state.codeInput.value = "";
        renderVerify();
        setStatus(
          isResend
            ? "If your details are eligible, a new verification code will be sent."
            : "If your details are eligible, a verification code will be sent automatically. Enter it here when it arrives.",
          "info"
        );
      } catch (error) {
        setStatus(errorCopy(error, "start"), "error");
      } finally {
        setBusy(false);
      }
    };

    const verifyChallenge = async () => {
      if (state.busy) return;
      const code = state.codeInput?.value || "";
      if (!/^\d{6}$/.test(code)) {
        setStatus("Enter the six-digit verification code.", "error");
        return;
      }
      setStatus("", "");
      setBusy(true);
      try {
        const result = await postAuth("signup/verify", {
          challengeId: state.challengeId,
          code
        });
        renderComplete(
          (result.message || "Your account has been created.") +
          " You can now sign in through WhatsApp to access your provisional workspace."
        );
      } catch (error) {
        setStatus(errorCopy(error, "verify"), "error");
      } finally {
        setBusy(false);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.stage === "details") void startChallenge(false);
      else if (state.stage === "verify") void verifyChallenge();
    });
    resend.addEventListener("click", () => void startChallenge(true));
    changeDetails.addEventListener("click", () => {
      setStatus("", "");
      renderDetails();
      fullName.input.focus({ preventScroll: true });
    });

    overlay.append(dialog);
    dialog.append(header, description, status, form);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeDialog();
    });
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !activeDialog) return;
      const focusable = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    activeDialog = { overlay, previousFocus, previousOverflow, onKeyDown };
    document.body.style.overflow = "hidden";
    document.body.append(overlay);
    document.addEventListener("keydown", onKeyDown, true);
    renderDetails();
    fullName.input.focus({ preventScroll: true });
  };

  document.addEventListener("click", (event) => {
    if (!REGISTER_PATH.test(window.location.pathname)) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button[data-brand="whatsapp"]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openDialog(button);
  }, true);
})();
