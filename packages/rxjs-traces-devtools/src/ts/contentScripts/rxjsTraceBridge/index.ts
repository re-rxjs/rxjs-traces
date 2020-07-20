
window.addEventListener("message", event => {
	const { data, origin } = event;

	if(origin !== window.location.origin) {
		return;
	}

	if(data && typeof data === 'object' && data.source === 'rxjs-traces-bridge') {
		chrome.runtime.sendMessage(data.payload);
	}
}, false);
