import presenters from "./stage-presenters.json"

type PresenterMission = keyof typeof presenters

/** Stage characters are video assets; mission-center laboratory backgrounds stay separate. */
export function stagePresenter(mission: PresenterMission, station: string) {
  const presenter = presenters[mission]
  const dialogue = (presenter.dialogues as Record<string, string>)[station]
  if (!dialogue) throw new Error(`Missing presenter briefing: ${mission}/${station}`)
  return {
    presenterName: presenter.name,
    presenterRole: presenter.role,
    presenterDialogue: dialogue,
    poster: `/mission/${mission}/video/posters/presenter-v2.webp`,
    src: `/mission/${mission}/video/${station}-v2.mp4`,
    captions: `/mission/${mission}/video/${station}-zh-v2.vtt`,
  }
}
