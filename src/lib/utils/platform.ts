type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string } };

export function isMacPlatform(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}

	const platform =
		(navigator as NavigatorWithUAData).userAgentData?.platform ||
		navigator.platform ||
		navigator.userAgent ||
		'';

	return /mac|ipod|iphone|ipad/i.test(platform);
}
