<script lang="ts">
	import { Marker } from 'svelte-maplibre-gl';
	import Camera from '@lucide/svelte/icons/camera';
	import CameraOff from '@lucide/svelte/icons/camera-off';

	let { lnglat, hasPhoto = true }: { lnglat: { lng: number; lat: number }; hasPhoto?: boolean } =
		$props();
</script>

<Marker {lnglat}>
	{#snippet content()}
		<div class="panoramax-marker" class:no-photo={!hasPhoto}>
			{#if hasPhoto}
				<Camera size={14} strokeWidth={2.5} />
			{:else}
				<CameraOff size={14} strokeWidth={2.5} />
			{/if}
		</div>
	{/snippet}
</Marker>

<style>
	.panoramax-marker {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: white;
		border: 2px solid #2563eb;
		border-radius: 9999px;
		color: #2563eb;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	}

	.panoramax-marker.no-photo {
		border-color: #9ca3af;
		color: #6b7280;
	}
</style>
