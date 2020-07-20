
const handleMessage = (event: MessageEvent) => {
	const { data, origin } = event;

	if(origin !== window.location.origin) {
		return;
	}

	if(data && typeof data === 'object' && data.source === 'rxjs-traces-bridge') {
		chrome.runtime.sendMessage(JSON.parse(data.payload));
	}
}

window.addEventListener("message", handleMessage, false);

chrome.runtime.connect().onDisconnect.addListener(function() {
	window.removeEventListener("message", handleMessage);
});
