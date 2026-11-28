export type StoryStage =
  | 'wake'
  | 'phone_message'
  | 'leave_home'
  | 'outside'
  | 'street_choice'
  | 'approach_police'
  | 'go_left'
  | 'near_crowd'
  | 'meet_saman'
  | 'chapter_end'

export type ObjectiveId =
  | 'leave_home'
  | 'reach_meetup'
  | 'go_left'
  | 'find_saman'
  | null

type Listener = (stage: StoryStage, objective: ObjectiveId) => void

export class StoryManager {
  stage: StoryStage = 'wake'
  objective: ObjectiveId = null
  flags = {
    phoneSeen: false,
    innerVoicePlayed: false,
    leftRoom: false,
    leftBuilding: false,
    policeWarned: false,
    policeShot: false,
    samanMsgShown: false,
    chapterEnded: false
  }
  private listeners: Listener[] = []

  onChange(fn: Listener) {
    this.listeners.push(fn)
  }

  private emit() {
    this.listeners.forEach(fn => fn(this.stage, this.objective))
  }

  setStage(s: StoryStage) {
    this.stage = s
    this.emit()
  }

  setObjective(o: ObjectiveId) {
    this.objective = o
    this.emit()
  }

  /** After video: player in room, show phone */
  startChapter() {
    this.stage = 'wake'
    this.objective = null
    this.flags = {
      phoneSeen: false,
      innerVoicePlayed: false,
      leftRoom: false,
      leftBuilding: false,
      policeWarned: false,
      policeShot: false,
      samanMsgShown: false,
      chapterEnded: false
    }
    this.emit()
  }

  onPhoneOpened() {
    this.flags.phoneSeen = true
    this.stage = 'phone_message'
    this.objective = 'leave_home'
    this.emit()
  }

  onInnerVoice() {
    this.flags.innerVoicePlayed = true
  }

  onLeftRoom() {
    if (!this.flags.leftRoom) {
      this.flags.leftRoom = true
      this.stage = 'leave_home'
      this.emit()
    }
  }

  onLeftBuilding() {
    if (!this.flags.leftBuilding) {
      this.flags.leftBuilding = true
      this.stage = 'outside'
      this.objective = 'reach_meetup'
      this.emit()
    }
  }

  onEnteredStreet() {
    this.stage = 'street_choice'
    this.objective = 'go_left'
    this.emit()
  }

  onNearPolice() {
    this.stage = 'approach_police'
    this.emit()
  }

  onGoLeftPath() {
    this.stage = 'go_left'
    if (!this.flags.samanMsgShown) {
      this.flags.samanMsgShown = true
    }
    this.emit()
  }

  onNearCrowd() {
    this.stage = 'near_crowd'
    this.objective = 'find_saman'
    this.emit()
  }

  onMeetSaman() {
    this.stage = 'meet_saman'
    this.objective = null
    this.emit()
  }

  endChapter() {
    this.stage = 'chapter_end'
    this.flags.chapterEnded = true
    this.objective = null
    this.emit()
  }
}

export const story = new StoryManager()

export const OBJECTIVE_TEXT: Record<Exclude<ObjectiveId, null>, string> = {
  leave_home: 'از خانه خارج شو',
  reach_meetup: 'به محل قرار برس',
  go_left: 'مسیر سمت چپ را ادامه بده',
  find_saman: 'سامان را پیدا کن'
}
