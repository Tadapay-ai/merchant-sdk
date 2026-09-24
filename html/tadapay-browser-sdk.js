export function openHostedCheckout(hostedUrl, { target = "_blank" } = {}) {
  if (!hostedUrl) throw new Error("hostedUrl is required");
  window.open(hostedUrl, target, "noopener,noreferrer");
}

export function openSubscriptionAuthorization(authorizationUrl, { target = "_blank" } = {}) {
  if (!authorizationUrl) throw new Error("authorizationUrl is required");
  window.open(authorizationUrl, target, "noopener,noreferrer");
}

export function mountPayWithAgentButton({
  element,
  hostedUrl,
  label = "Pay with Agent",
  loadingLabel = "Opening...",
  unavailableLabel = "Agent checkout unavailable",
  expiredLabel = "Agent checkout expired",
  className = "tadapay-pay-with-agent",
  disabled = false,
  status = "open",
  target = "_blank",
  onClick,
}) {
  const container = typeof element === "string" ? document.querySelector(element) : element;
  if (!container) throw new Error("TadaPay target element not found");
  if (!hostedUrl) throw new Error("hostedUrl is required");

  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.tadapayHostedUrl = hostedUrl;
  button.textContent = label;
  applyButtonState(button, { disabled, status, label, unavailableLabel, expiredLabel });

  button.addEventListener("click", async (event) => {
    if (button.disabled) return;
    if (onClick) {
      const result = onClick({ event, hostedUrl, button });
      if (result === false) return;
      if (result && typeof result.then === "function") {
        button.disabled = true;
        button.textContent = loadingLabel;
        await result;
      }
    }
    openHostedCheckout(hostedUrl, { target });
  });

  container.appendChild(button);
  return button;
}

export function updatePayWithAgentButton(button, options) {
  applyButtonState(button, options);
  return button;
}

function applyButtonState(
  button,
  {
    disabled = false,
    status = "open",
    label = "Pay with Agent",
    unavailableLabel = "Agent checkout unavailable",
    expiredLabel = "Agent checkout expired",
  } = {},
) {
  const unavailable = ["canceled", "failed", "succeeded", "completed"].includes(status);
  const expired = status === "expired";
  button.disabled = Boolean(disabled || unavailable || expired);
  button.dataset.tadapayStatus = status;
  if (expired) button.textContent = expiredLabel;
  else if (unavailable) button.textContent = unavailableLabel;
  else button.textContent = label;
}
