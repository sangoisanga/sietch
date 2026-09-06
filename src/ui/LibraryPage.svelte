<script lang="ts">
  import ExercisesList from './ExercisesList.svelte'
  import ForgeBox from './ForgeBox.svelte'
  import Note from './primitives/Note.svelte'

  let { runTask }: { runTask: (label: string, detail: string, work: () => Promise<void>) => Promise<void> } = $props()
</script>

<h1 class="lead">Library</h1>
<Note>
  Write new passages, keep the ones worth repeating, and share a pool with someone else.
  Nothing here plays audio — open something and the drill takes over.
</Note>

<hr>

<ForgeBox {runTask} />

<hr>

<ExercisesList />

<style>
  .lead { margin-top: 22px }
</style>
