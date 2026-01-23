<script lang="ts">
	import { Marker } from 'svelte-maplibre-gl';

	interface Props {
		lnglat: { lng: number; lat: number };
		fading?: boolean;
	}

	let { lnglat, fading = false }: Props = $props();
</script>

<Marker {lnglat}>
	{#snippet content()}
		<div class="geocoder-marker" class:fading>
			<div class="pulse-ring"></div>
			<div class="pulse-ring delay"></div>
			<div class="marker-dot"></div>
		</div>
	{/snippet}
</Marker>

<style>
	.geocoder-marker {
		position: relative;
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity 1s ease-out;
	}

	.geocoder-marker.fading {
		opacity: 0;
	}

	.pulse-ring {
		position: absolute;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: rgba(59, 130, 246, 0.4);
		animation: pulse 1.5s ease-out infinite;
	}

	.pulse-ring.delay {
		animation-delay: 0.75s;
	}

	.marker-dot {
		position: relative;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: #2563eb;
		border: 3px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	@keyframes pulse {
		0% {
			transform: scale(0.3);
			opacity: 1;
		}
		100% {
			transform: scale(1.2);
			opacity: 0;
		}
	}
</style>
