import './style.css'
import Phaser from 'phaser'

const WIDTH = 450
const HEIGHT = 800
const WORLD_WIDTH = 1200
const WORLD_HEIGHT = 1700
const CHARACTER_ATLAS_KEY = 'kenney-characters'
const CHARACTER_ATLAS_IMAGE = 'kenney_top-down-shooter/Spritesheet/spritesheet_characters.png'
const CHARACTER_ATLAS_XML = 'kenney_top-down-shooter/Spritesheet/spritesheet_characters.xml'
const DIRECTION_COUNT = 8
const DIRECTION_STEP = (Math.PI * 2) / DIRECTION_COUNT
const DIRECTION_ROTATION_SPEED = 12
const FACE_DOWN_ROTATION = Math.PI / 2
const SAFE_ZONE = {
  left: 255,
  top: 70,
  right: 945,
  bottom: 662,
  gateLeft: 555,
  gateRight: 645,
}
const CAMP_RESPAWN_TIME = 7000
const ENEMY_AGGRO_RANGE = 230
const ENEMY_LEASH_RANGE = 300
const ENEMY_SEPARATION = 33
const ENEMY_CAMPS = [
  { x: 400, y: 780, count: 8 },
  { x: 800, y: 780, count: 8 },
  { x: 600, y: 940, count: 10 },
  { x: 360, y: 1120, count: 8 },
  { x: 840, y: 1120, count: 8 },
]
const MERCHANT = {
  x: 600,
  y: 190,
  interactRange: 58,
}
const COOK_NPC = {
  x: 460,
  y: 350,
  interactRange: 58,
}
const TRADER_NPC = {
  x: 740,
  y: 350,
  interactRange: 58,
}
const COMPANION_BEACON = {
  x: 600,
  y: 505,
  cost: 5,
  max: 5,
  interactRange: 62,
}
const RANGED_BEACON = {
  x: 740,
  y: 505,
  cost: 80,
  interactRange: 62,
}
const RANGED_ATTACK = {
  range: 260,
}
const COMPANION = {
  speed: 185,
  followDistance: 42,
  huntRange: 360,
  attackRange: 42,
  attackRate: 1040,
  damage: 1,
  separation: 30,
}
const MEAT_VALUE = 1
const COINS_PER_COOKED_MEAT = 1
const PLAYER_MAX_HP = 1000
const HEALTH_BAR = {
  width: 34,
  height: 5,
  yOffset: 25,
}
const CARRY_STACK = {
  visibleLimit: 12,
  baseYOffset: -28,
  itemGap: 8,
  rawXOffset: -13,
  cookedXOffset: 13,
}
const COOK_DEPOSIT_TIME = 100
const COOK_TIME = 500
const COOK_PICKUP_TIME = 200
const SELL_DEPOSIT_TIME = 200
const SELL_CONVERT_TIME = 400
const SELL_COIN_PICKUP_TIME = 150
const COOK_STACK = {
  visibleLimit: 12,
  itemGap: 8,
  rawXOffset: 42,
  cookedXOffset: -42,
  yOffset: 30,
}
const SELL_STACK = {
  visibleLimit: 12,
  itemGap: 8,
  cookedXOffset: -42,
  coinXOffset: 42,
  yOffset: 30,
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  preload() {
    this.load.atlasXML(CHARACTER_ATLAS_KEY, CHARACTER_ATLAS_IMAGE, CHARACTER_ATLAS_XML)
    this.load.image('cook', 'assets/cook.png')
    this.load.image('sell', 'assets/sell.png')
    this.load.image('up', 'assets/up.png')
  }

  create() {
    this.hp = PLAYER_MAX_HP
    this.maxHp = PLAYER_MAX_HP
    this.score = 0
    this.coins = 0
    this.rawMeat = 0
    this.cookingRawMeat = 0
    this.readyCookedMeat = 0
    this.cookedMeat = 0
    this.sellingCookedMeat = 0
    this.readyCoins = 0
    this.cookDepositTimer = 0
    this.cookPickupTimer = 0
    this.cookTimer = 0
    this.sellDepositTimer = 0
    this.sellConvertTimer = 0
    this.sellCoinPickupTimer = 0
    this.elapsed = 0
    this.gameOver = false
    this.isUpgrading = false
    this.playerSpeed = 220
    this.enemySpeed = 62
    this.attackRate = 620
    this.attackDamage = 1
    this.attackRange = 58
    this.attackCooldown = 0
    this.hasRangedAttack = false
    this.touchInput = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    }

    this.cameras.main.setBackgroundColor('#f7f7f2')
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    this.drawArena()
    this.characterFrames = this.createCharacterFrameMaps()

    this.enemies = []
    this.companions = []
    this.meatOnGround = []
    this.carriedStackSprites = []
    this.cookStackSprites = []
    this.sellStackSprites = []
    this.enemySlots = []
    this.upgradeCounts = {
      blade: 0,
      speed: 0,
      reach: 0,
      boots: 0,
      heal: 0,
    }

    this.createEnemyCamps()
    this.createMerchant()
    this.createCookNpc()
    this.createTraderNpc()
    this.createCompanionBeacon()
    this.createRangedBeacon()

    this.player = this.add.image(
      (SAFE_ZONE.left + SAFE_ZONE.right) / 2,
      430,
      CHARACTER_ATLAS_KEY,
      this.characterFrames.player.defaultFrame,
    )
    this.player.characterFrameMap = this.characterFrames.player
    this.player.setDisplaySize(37, 43)
    this.player.radius = 16
    this.player.setDepth(5)
    this.applyDirectionalSprite(this.player, new Phaser.Math.Vector2(0, 1), 1)
    this.attachCharacterShadow(this.player, 32, 10, 12, 4)
    this.player.healthBar = this.createHealthBar(this.player, this.maxHp)
    this.refreshCarriedStacks()
    this.refreshCookStacks()
    this.refreshSellStacks()
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    })

    this.createTouchControls()

    this.hpText = this.add.text(18, 18, `HP ${this.hp}`, {
      fontSize: '22px',
      color: '#111111',
      fontStyle: 'bold',
    })
    this.hpText.setScrollFactor(0)
    this.hpText.setDepth(1000)

    this.scoreText = this.add.text(18, 48, 'KILL 0', {
      fontSize: '18px',
      color: '#333333',
    })
    this.scoreText.setScrollFactor(0)
    this.scoreText.setDepth(1000)

    this.coinBadge = this.add.rectangle(WIDTH - 18, 14, 112, 36, 0x111111, 0.92)
    this.coinBadge.setOrigin(1, 0)
    this.coinBadge.setScrollFactor(0)
    this.coinBadge.setDepth(1000)

    this.coinText = this.add.text(WIDTH - 32, 21, `COIN ${this.coins}`, {
      fontSize: '17px',
      color: '#f3c431',
      fontStyle: 'bold',
    }).setOrigin(1, 0)
    this.coinText.setScrollFactor(0)
    this.coinText.setDepth(1001)

    this.timeText = this.add.text(WIDTH / 2, 18, '00:00', {
      fontSize: '22px',
      color: '#111111',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)
    this.timeText.setScrollFactor(0)
    this.timeText.setDepth(1000)

    this.merchantPrompt = this.add.text(WIDTH / 2, MERCHANT.y + 50, '', {
      fontSize: '14px',
      color: '#7a5814',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.merchantPrompt.setScrollFactor(0)
    this.merchantPrompt.setDepth(1000)

    this.controlHintText = this.add.text(WIDTH / 2, HEIGHT - 28, 'MOVE: WASD / ARROW / DRAG', {
      fontSize: '14px',
      color: '#777777',
    }).setOrigin(0.5)
    this.controlHintText.setScrollFactor(0)
    this.controlHintText.setDepth(1000)
  }

  update(time, delta) {
    if (this.gameOver || this.isUpgrading) {
      return
    }

    const dt = delta / 1000
    this.elapsed += dt
    this.attackCooldown -= delta

    this.updateTimer()
    this.movePlayer(dt)
    this.updateEnemyCamps(delta)
    this.moveEnemies(dt)
    this.updateCompanions(dt, delta)
    this.attackNearestEnemy()
    this.collectMeat()
    this.updateCookDeposit(delta)
    this.updateCooking(delta)
    this.updateCookedPickup(delta)
    this.updateSellDeposit(delta)
    this.updateSellConversion(delta)
    this.updateSellCoinPickup(delta)
    this.updateNpcPrompt()
    this.updateHealthBar(this.player, this.hp, this.maxHp)
    this.updateCharacterShadow(this.player)
    this.updateCarriedStacks()
  }

  createCharacterShadow(target, width, height, yOffset, depth = 0) {
    const shadow = this.add.ellipse(target.x, target.y + yOffset, width, height, 0x111111, 0.18)
    shadow.setDepth(depth)
    return shadow
  }

  createCharacterFrameMaps() {
    const frameNames = this.textures.get(CHARACTER_ATLAS_KEY).getFrameNames()

    return {
      player: this.createDirectionalFrameMap(frameNames, ['survivor1'], 'hold'),
      enemy: this.createDirectionalFrameMap(frameNames, ['zombie1', 'zoimbie1'], 'hold'),
      soldier: this.createDirectionalFrameMap(frameNames, ['soldier1'], 'hold'),
    }
  }

  createDirectionalFrameMap(frameNames, characterNames, preferredPose) {
    const framesByPose = {}

    for (const characterName of characterNames) {
      for (const frameName of frameNames) {
        const match = frameName.match(new RegExp(`^${characterName}_(.+)\\.png$`, 'i'))

        if (!match) {
          continue
        }

        framesByPose[match[1].toLowerCase()] = frameName
      }
    }

    const defaultFrame = framesByPose[preferredPose]
      || framesByPose.stand
      || framesByPose.gun
      || Object.values(framesByPose)[0]

    if (!defaultFrame) {
      throw new Error(`Missing Kenney character frame: ${characterNames.join(', ')}`)
    }

    return {
      defaultFrame,
      frames: {
        right: defaultFrame,
        downRight: defaultFrame,
        down: defaultFrame,
        downLeft: defaultFrame,
        left: defaultFrame,
        upLeft: defaultFrame,
        up: defaultFrame,
        upRight: defaultFrame,
      },
      poses: framesByPose,
    }
  }

  applyDirectionalSprite(target, direction, dt) {
    if (!target.characterFrameMap || direction.lengthSq() === 0) {
      return
    }

    const directionName = this.getDirectionName(direction)
    const targetAngle = this.getDirectionAngle(direction)
    const frame = target.characterFrameMap.frames[directionName]

    if (frame && target.frame.name !== frame) {
      target.setFrame(frame)
    }

    target.rotation = Phaser.Math.Angle.RotateTo(
      target.rotation,
      targetAngle,
      DIRECTION_ROTATION_SPEED * dt,
    )
  }

  getDirectionName(direction) {
    const index = this.getDirectionIndex(direction)
    return [
      'right',
      'downRight',
      'down',
      'downLeft',
      'left',
      'upLeft',
      'up',
      'upRight',
    ][index]
  }

  getDirectionAngle(direction) {
    return this.getDirectionIndex(direction) * DIRECTION_STEP
  }

  getDirectionIndex(direction) {
    const angle = Phaser.Math.Angle.Normalize(Math.atan2(direction.y, direction.x))
    return Math.round(angle / DIRECTION_STEP) % DIRECTION_COUNT
  }

  updateCharacterShadow(target) {
    if (!target.shadow) {
      return
    }

    target.shadow.setPosition(target.x, target.y + target.shadowYOffset)
  }

  attachCharacterShadow(target, width, height, yOffset, depth = 0) {
    target.shadowYOffset = yOffset
    target.shadow = this.createCharacterShadow(target, width, height, yOffset, depth)
  }

  destroyCharacterShadow(target) {
    if (!target.shadow) {
      return
    }

    target.shadow.destroy()
    target.shadow = null
  }

  drawArena() {
    this.add.grid(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 45, 45, 0xf7f7f2, 1, 0xe6e6df, 1)
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH - 28, WORLD_HEIGHT - 28, 0xffffff, 0)
      .setStrokeStyle(2, 0xd8d8cf)

    this.add.rectangle(
      (SAFE_ZONE.left + SAFE_ZONE.right) / 2,
      (SAFE_ZONE.top + SAFE_ZONE.bottom) / 2,
      SAFE_ZONE.right - SAFE_ZONE.left,
      SAFE_ZONE.bottom - SAFE_ZONE.top,
      0xfff4a8,
      0.42,
    )

    this.add.rectangle((SAFE_ZONE.left + SAFE_ZONE.right) / 2, SAFE_ZONE.bottom + 30, 106, 54, 0xf6d178, 0.42)
      .setStrokeStyle(2, 0xe3b756, 0.65)

    this.add.text((SAFE_ZONE.left + SAFE_ZONE.right) / 2, SAFE_ZONE.top + 30, 'SAFE ZONE', {
      fontSize: '18px',
      color: '#8a6b12',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.drawFence()
    this.drawCamps()
  }

  drawFence() {
    const postColor = 0xf0ad2f
    const railColor = 0xd78022
    const postSize = 10
    const spacing = 16

    for (let x = SAFE_ZONE.left; x <= SAFE_ZONE.right; x += spacing) {
      this.add.rectangle(x, SAFE_ZONE.top, postSize, 34, postColor)
        .setStrokeStyle(1, railColor)
    }

    for (let y = SAFE_ZONE.top + spacing; y <= SAFE_ZONE.bottom; y += spacing) {
      this.add.rectangle(SAFE_ZONE.left, y, postSize, 34, postColor)
        .setStrokeStyle(1, railColor)
      this.add.rectangle(SAFE_ZONE.right, y, postSize, 34, postColor)
        .setStrokeStyle(1, railColor)
    }

    for (let x = SAFE_ZONE.left; x <= SAFE_ZONE.right; x += spacing) {
      if (x > SAFE_ZONE.gateLeft - 6 && x < SAFE_ZONE.gateRight + 6) {
        continue
      }

      this.add.rectangle(x, SAFE_ZONE.bottom, postSize, 34, postColor)
        .setStrokeStyle(1, railColor)
    }

    this.add.rectangle(SAFE_ZONE.gateLeft - 12, SAFE_ZONE.bottom + 12, 18, 52, 0xd87921)
      .setStrokeStyle(2, 0xb75c19)
    this.add.rectangle(SAFE_ZONE.gateRight + 12, SAFE_ZONE.bottom + 12, 18, 52, 0xd87921)
      .setStrokeStyle(2, 0xb75c19)
    this.add.text((SAFE_ZONE.left + SAFE_ZONE.right) / 2, SAFE_ZONE.bottom + 64, 'EXIT', {
      fontSize: '13px',
      color: '#9b5a14',
      fontStyle: 'bold',
    }).setOrigin(0.5)
  }

  drawCamps() {
    for (const camp of ENEMY_CAMPS) {
      this.add.circle(camp.x, camp.y, 56, 0xff6b6b, 0.06)
        .setStrokeStyle(2, 0xe33b3b, 0.24)
      this.add.circle(camp.x, camp.y, 8, 0xe33b3b, 0.8)
      this.add.text(camp.x, camp.y + 68, 'ENEMY CAMP', {
        fontSize: '11px',
        color: '#a83333',
        fontStyle: 'bold',
      }).setOrigin(0.5)
    }
  }

  createMerchant() {
    this.merchant = this.add.image(MERCHANT.x, MERCHANT.y, 'up')
    this.merchant.setDisplaySize(36, 36)
    this.merchant.setRotation(FACE_DOWN_ROTATION)
    this.merchant.setDepth(5)
    this.attachCharacterShadow(this.merchant, 34, 11, 13, 4)
    this.merchant.setInteractive({ useHandCursor: true })

    this.add.rectangle(MERCHANT.x, MERCHANT.y - 25, 42, 18, 0xffffff, 0.96)
      .setStrokeStyle(2, 0x3c7dd9)
    this.add.text(MERCHANT.x, MERCHANT.y - 25, 'UP', {
      fontSize: '12px',
      color: '#25538f',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.merchant.on('pointerdown', () => {
      this.tryOpenUpgradeShop()
    })
  }

  createCookNpc() {
    this.cookNpc = this.add.image(COOK_NPC.x, COOK_NPC.y, 'cook')
    this.cookNpc.setDisplaySize(36, 36)
    this.cookNpc.setRotation(FACE_DOWN_ROTATION)
    this.cookNpc.setDepth(5)
    this.attachCharacterShadow(this.cookNpc, 34, 11, 13, 4)
    this.cookNpc.setInteractive({ useHandCursor: true })

    this.add.rectangle(COOK_NPC.x, COOK_NPC.y - 25, 54, 18, 0xffffff, 0.96)
      .setStrokeStyle(2, 0xc76d2a)
    this.add.text(COOK_NPC.x, COOK_NPC.y - 25, 'COOK', {
      fontSize: '11px',
      color: '#8c3f24',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.cookNpc.on('pointerdown', () => {
      this.tryCookMeat()
    })
  }

  createTraderNpc() {
    this.traderNpc = this.add.image(TRADER_NPC.x, TRADER_NPC.y, 'sell')
    this.traderNpc.setDisplaySize(36, 36)
    this.traderNpc.setRotation(FACE_DOWN_ROTATION)
    this.traderNpc.setDepth(5)
    this.attachCharacterShadow(this.traderNpc, 34, 11, 13, 4)
    this.traderNpc.setInteractive({ useHandCursor: true })

    this.add.rectangle(TRADER_NPC.x, TRADER_NPC.y - 25, 50, 18, 0xffffff, 0.96)
      .setStrokeStyle(2, 0x37a56d)
    this.add.text(TRADER_NPC.x, TRADER_NPC.y - 25, 'SELL', {
      fontSize: '11px',
      color: '#26764d',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.traderNpc.on('pointerdown', () => {
      this.trySellCookedMeat()
    })
  }

  createCompanionBeacon() {
    this.add.circle(COMPANION_BEACON.x, COMPANION_BEACON.y, 42, 0xffffff, 0)
      .setStrokeStyle(4, 0xffffff, 0.9)
    this.add.circle(COMPANION_BEACON.x, COMPANION_BEACON.y, 33, 0x111111, 0)
      .setStrokeStyle(3, 0xffffff, 0.82)
    this.add.rectangle(COMPANION_BEACON.x, COMPANION_BEACON.y + 8, 76, 34, 0xffffff, 0.92)
      .setStrokeStyle(2, 0x2f8f57)

    this.companionBeacon = this.add.circle(COMPANION_BEACON.x, COMPANION_BEACON.y - 16, 16, 0x2ecc71, 0.95)
    this.companionBeacon.setStrokeStyle(4, 0xffffff)
    this.companionBeacon.setInteractive({ useHandCursor: true })

    this.add.text(COMPANION_BEACON.x, COMPANION_BEACON.y - 16, '+', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.companionBeaconText = this.add.text(COMPANION_BEACON.x, COMPANION_BEACON.y + 8, '', {
      fontSize: '12px',
      color: '#1d5f37',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5)

    this.companionBeacon.on('pointerdown', () => {
      this.tryBuyCompanion()
    })

    this.updateCompanionBeaconText()
  }

  createRangedBeacon() {
    this.add.circle(RANGED_BEACON.x, RANGED_BEACON.y, 42, 0xffffff, 0)
      .setStrokeStyle(4, 0xffffff, 0.9)
    this.add.circle(RANGED_BEACON.x, RANGED_BEACON.y, 33, 0x111111, 0)
      .setStrokeStyle(3, 0xffffff, 0.82)
    this.add.rectangle(RANGED_BEACON.x, RANGED_BEACON.y + 8, 82, 34, 0xffffff, 0.92)
      .setStrokeStyle(2, 0x8f5bd6)

    this.rangedBeacon = this.add.circle(RANGED_BEACON.x, RANGED_BEACON.y - 16, 16, 0x9b59b6, 0.95)
    this.rangedBeacon.setStrokeStyle(4, 0xffffff)
    this.rangedBeacon.setInteractive({ useHandCursor: true })

    this.add.text(RANGED_BEACON.x, RANGED_BEACON.y - 16, 'B', {
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.rangedBeaconText = this.add.text(RANGED_BEACON.x, RANGED_BEACON.y + 8, '', {
      fontSize: '12px',
      color: '#6b3586',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5)

    this.rangedBeacon.on('pointerdown', () => {
      this.tryActivateRangedAttack()
    })

    this.updateRangedBeaconText()
  }

  createTouchControls() {
    this.joystickBase = this.add.circle(74, HEIGHT - 86, 42, 0x111111, 0.09)
    this.joystickBase.setStrokeStyle(2, 0x111111, 0.24)
    this.joystickBase.setScrollFactor(0)
    this.joystickBase.setDepth(1000)
    this.joystickBase.setVisible(false)

    this.joystickThumb = this.add.circle(74, HEIGHT - 86, 18, 0x111111, 0.18)
    this.joystickThumb.setStrokeStyle(2, 0x111111, 0.36)
    this.joystickThumb.setScrollFactor(0)
    this.joystickThumb.setDepth(1001)
    this.joystickThumb.setVisible(false)

    this.input.on('pointerdown', (pointer) => {
      if (this.gameOver || this.isUpgrading) {
        return
      }

      this.touchInput.active = true
      this.touchInput.startX = pointer.position.x
      this.touchInput.startY = pointer.position.y
      this.touchInput.currentX = pointer.position.x
      this.touchInput.currentY = pointer.position.y
      this.updateJoystick(pointer.position.x, pointer.position.y)
      this.joystickBase.setVisible(true)
      this.joystickThumb.setVisible(true)
    })

    this.input.on('pointermove', (pointer) => {
      if (!this.touchInput.active) {
        return
      }

      this.touchInput.currentX = pointer.position.x
      this.touchInput.currentY = pointer.position.y
      this.updateJoystick(pointer.position.x, pointer.position.y)
    })

    this.input.on('pointerup', () => {
      this.clearTouchInput()
    })

    this.input.on('pointerupoutside', () => {
      this.clearTouchInput()
    })
  }

  updateJoystick(x, y) {
    const drag = new Phaser.Math.Vector2(
      x - this.touchInput.startX,
      y - this.touchInput.startY,
    )
    const radius = 34

    if (drag.length() > radius) {
      drag.setLength(radius)
    }

    this.joystickBase.setPosition(this.touchInput.startX, this.touchInput.startY)
    this.joystickThumb.setPosition(
      this.touchInput.startX + drag.x,
      this.touchInput.startY + drag.y,
    )
  }

  clearTouchInput() {
    this.touchInput.active = false
    this.joystickBase.setVisible(false)
    this.joystickThumb.setVisible(false)
  }

  movePlayer(dt) {
    const xAxis = Number(this.keys.right.isDown || this.keys.arrowRight.isDown)
      - Number(this.keys.left.isDown || this.keys.arrowLeft.isDown)
    const yAxis = Number(this.keys.down.isDown || this.keys.arrowDown.isDown)
      - Number(this.keys.up.isDown || this.keys.arrowUp.isDown)

    const direction = new Phaser.Math.Vector2(xAxis, yAxis)
    const touchDirection = this.getTouchDirection()

    if (touchDirection.lengthSq() > 0) {
      direction.add(touchDirection)
    }

    if (direction.lengthSq() > 0) {
      direction.normalize()
      const previousX = this.player.x
      const previousY = this.player.y

      this.player.x += direction.x * this.playerSpeed * dt
      this.player.y += direction.y * this.playerSpeed * dt
      this.resolveFenceCollision(previousX, previousY)
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 30, WORLD_WIDTH - 30)
    this.player.y = Phaser.Math.Clamp(this.player.y, 80, WORLD_HEIGHT - 40)
    this.applyDirectionalSprite(this.player, direction, dt)
  }

  resolveFenceCollision(previousX, previousY) {
    const wasInSafeZone = this.isInSafeZone(previousX, previousY)
    const isInSafeZone = this.isInSafeZone(this.player.x, this.player.y)

    if (wasInSafeZone === isInSafeZone) {
      return
    }

    const crossedBottomGate = this.isInGate(this.player.x)
      && this.crossedSafeZoneBottom(previousY, this.player.y)

    if (crossedBottomGate) {
      return
    }

    this.player.x = previousX
    this.player.y = previousY
  }

  isInSafeZone(x, y) {
    return x >= SAFE_ZONE.left
      && x <= SAFE_ZONE.right
      && y >= SAFE_ZONE.top
      && y <= SAFE_ZONE.bottom
  }

  isInGate(x) {
    return x >= SAFE_ZONE.gateLeft && x <= SAFE_ZONE.gateRight
  }

  crossedSafeZoneBottom(previousY, currentY) {
    return (previousY <= SAFE_ZONE.bottom && currentY > SAFE_ZONE.bottom)
      || (previousY > SAFE_ZONE.bottom && currentY <= SAFE_ZONE.bottom)
  }

  getTouchDirection() {
    if (!this.touchInput.active) {
      return new Phaser.Math.Vector2(0, 0)
    }

    const direction = new Phaser.Math.Vector2(
      this.touchInput.currentX - this.touchInput.startX,
      this.touchInput.currentY - this.touchInput.startY,
    )

    if (direction.lengthSq() < 64) {
      return new Phaser.Math.Vector2(0, 0)
    }

    return direction.normalize()
  }

  createEnemyCamps() {
    ENEMY_CAMPS.forEach((camp, campIndex) => {
      for (let index = 0; index < camp.count; index += 1) {
        const angle = (Math.PI * 2 * index) / camp.count
        const radius = 26 + (index % 3) * 12
        const slot = {
          campIndex,
          x: camp.x + Math.cos(angle) * radius,
          y: camp.y + Math.sin(angle) * radius,
          respawnTimer: 0,
          enemy: null,
        }

        this.enemySlots.push(slot)
        this.spawnEnemyAtSlot(slot)
      }
    })
  }

  updateEnemyCamps(delta) {
    for (const slot of this.enemySlots) {
      if (slot.enemy) {
        continue
      }

      slot.respawnTimer -= delta

      if (slot.respawnTimer <= 0) {
        this.spawnEnemyAtSlot(slot)
      }
    }
  }

  spawnEnemyAtSlot(slot) {
    const x = slot.x + Phaser.Math.Between(-10, 10)
    const y = slot.y + Phaser.Math.Between(-10, 10)
    const enemy = this.add.image(x, y, CHARACTER_ATLAS_KEY, this.characterFrames.enemy.defaultFrame)
    enemy.characterFrameMap = this.characterFrames.enemy
    enemy.setDisplaySize(35, 43)
    enemy.radius = 14
    enemy.setDepth(4)
    this.applyDirectionalSprite(enemy, new Phaser.Math.Vector2(0, 1), 1)
    this.attachCharacterShadow(enemy, 28, 9, 11, 3)
    enemy.hp = 2
    enemy.maxHp = 2
    enemy.damageCooldown = 0
    enemy.homeX = slot.x
    enemy.homeY = slot.y
    enemy.slot = slot
    enemy.healthBar = this.createHealthBar(enemy, enemy.maxHp)
    slot.enemy = enemy
    this.enemies.push(enemy)
  }

  moveEnemies(dt) {
    const playerIsSafe = this.isInSafeZone(this.player.x, this.player.y)

    for (const enemy of this.enemies) {
      const playerDistance = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y,
      )
      const homeDistance = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        enemy.homeX,
        enemy.homeY,
      )
      const shouldChase = !playerIsSafe
        && playerDistance <= ENEMY_AGGRO_RANGE
        && homeDistance <= ENEMY_LEASH_RANGE
      const targetX = shouldChase ? this.player.x : enemy.homeX
      const targetY = shouldChase ? this.player.y : enemy.homeY
      const direction = new Phaser.Math.Vector2(targetX - enemy.x, targetY - enemy.y)

      if (direction.lengthSq() > 4) {
        direction.normalize()
      } else {
        direction.set(0, 0)
      }

      enemy.x += direction.x * this.enemySpeed * dt
      enemy.y += direction.y * this.enemySpeed * dt
      this.applyDirectionalSprite(enemy, direction, dt)
      enemy.damageCooldown -= dt
      this.updateHealthBar(enemy, enemy.hp, enemy.maxHp)

      if (
        !playerIsSafe
        && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
          <= enemy.radius + this.player.radius
        && enemy.damageCooldown <= 0
      ) {
        enemy.damageCooldown = 0.7
        this.damagePlayer(10)
      }
    }

    this.separateEnemies()

    for (const enemy of this.enemies) {
      this.updateCharacterShadow(enemy)
    }
  }

  separateEnemies() {
    for (let i = 0; i < this.enemies.length; i += 1) {
      for (let j = i + 1; j < this.enemies.length; j += 1) {
        const first = this.enemies[i]
        const second = this.enemies[j]
        const dx = second.x - first.x
        const dy = second.y - first.y
        const distanceSq = dx * dx + dy * dy

        if (distanceSq >= ENEMY_SEPARATION * ENEMY_SEPARATION) {
          continue
        }

        const distance = Math.sqrt(distanceSq) || 1
        const overlap = (ENEMY_SEPARATION - distance) / 2
        const pushX = (dx / distance) * overlap
        const pushY = (dy / distance) * overlap

        first.x -= pushX
        first.y -= pushY
        second.x += pushX
        second.y += pushY

        this.clampEnemyToArena(first)
        this.clampEnemyToArena(second)
      }
    }

    for (const enemy of this.enemies) {
      this.updateHealthBar(enemy, enemy.hp, enemy.maxHp)
    }
  }

  clampEnemyToArena(enemy) {
    enemy.x = Phaser.Math.Clamp(enemy.x, 20, WORLD_WIDTH - 20)
    enemy.y = Phaser.Math.Clamp(enemy.y, SAFE_ZONE.bottom + 24, WORLD_HEIGHT - 28)
  }

  attackNearestEnemy() {
    if (
      this.attackCooldown > 0
      || this.enemies.length === 0
      || this.isInSafeZone(this.player.x, this.player.y)
    ) {
      return
    }

    let nearestEnemy = null
    let nearestDistance = Number.MAX_SAFE_INTEGER

    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Squared(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y,
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = enemy
      }
    }

    if (!nearestEnemy) {
      return
    }

    const currentAttackRange = this.hasRangedAttack ? RANGED_ATTACK.range : this.attackRange

    if (Math.sqrt(nearestDistance) > currentAttackRange) {
      return
    }

    this.attackCooldown = this.attackRate
    nearestEnemy.hp -= this.attackDamage
    if (this.hasRangedAttack) {
      this.showRangedHit(nearestEnemy)
    } else {
      this.showMeleeHit(nearestEnemy)
    }
    this.updateHealthBar(nearestEnemy, nearestEnemy.hp, nearestEnemy.maxHp)

    if (nearestEnemy.hp <= 0) {
      this.killEnemy(nearestEnemy)
      return
    }

    nearestEnemy.setTint(0xffeded)
    this.time.delayedCall(80, () => {
      if (nearestEnemy.active) {
        nearestEnemy.clearTint()
      }
    })
  }

  showRangedHit(enemy) {
    const projectile = this.add.circle(this.player.x, this.player.y, 6, 0x9b59b6, 0.95)
    projectile.setStrokeStyle(2, 0xffffff)
    projectile.setDepth(6)

    const trail = this.add.line(
      0,
      0,
      this.player.x,
      this.player.y,
      enemy.x,
      enemy.y,
      0x9b59b6,
      0.22,
    )
    trail.setOrigin(0, 0)
    trail.setDepth(4)

    this.tweens.add({
      targets: projectile,
      x: enemy.x,
      y: enemy.y,
      scale: 1.35,
      duration: 130,
      ease: 'Quad.Out',
      onComplete: () => projectile.destroy(),
    })

    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 150,
      onComplete: () => trail.destroy(),
    })
  }

  updateCompanions(dt, delta) {
    if (this.companions.length === 0) {
      return
    }

    this.companions.forEach((companion, index) => {
      companion.attackCooldown -= delta

      const target = this.findNearestEnemy(
        companion.x,
        companion.y,
        COMPANION.huntRange,
      )

      if (target) {
        const attackAngle = (index / Math.max(1, this.companions.length)) * Math.PI * 2
        const targetX = target.x + Math.cos(attackAngle) * (COMPANION.attackRange - 8)
        const targetY = target.y + Math.sin(attackAngle) * (COMPANION.attackRange - 8)
        this.moveCompanionToward(companion, targetX, targetY, dt, 8)

        const distance = Phaser.Math.Distance.Between(companion.x, companion.y, target.x, target.y)
        if (distance <= COMPANION.attackRange && companion.attackCooldown <= 0) {
          companion.attackCooldown = COMPANION.attackRate
          target.hp -= COMPANION.damage
          this.showCompanionHit(companion, target)
          this.updateHealthBar(target, target.hp, target.maxHp)

          if (target.hp <= 0) {
            this.killEnemy(target)
          } else {
            target.setTint(0xe8f8ff)
            this.time.delayedCall(80, () => {
              if (target.active) {
                target.clearTint()
              }
            })
          }
        }

        return
      }

      const angle = (index / Math.max(1, this.companions.length)) * Math.PI * 2
      const followX = this.player.x - 26 + Math.cos(angle) * COMPANION.followDistance
      const followY = this.player.y + 30 + Math.sin(angle) * 18
      this.moveCompanionToward(companion, followX, followY, dt, 8)
    })

    this.separateCompanions()
  }

  findNearestEnemy(x, y, maxDistance) {
    let nearestEnemy = null
    let nearestDistance = maxDistance * maxDistance

    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Squared(x, y, enemy.x, enemy.y)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = enemy
      }
    }

    return nearestEnemy
  }

  moveCompanionToward(companion, targetX, targetY, dt, stopDistance) {
    const distance = Phaser.Math.Distance.Between(companion.x, companion.y, targetX, targetY)
    if (distance <= stopDistance) {
      return
    }

    const direction = new Phaser.Math.Vector2(targetX - companion.x, targetY - companion.y).normalize()
    companion.x += direction.x * COMPANION.speed * dt
    companion.y += direction.y * COMPANION.speed * dt
    this.applyDirectionalSprite(companion.body, direction, dt)
    companion.x = Phaser.Math.Clamp(companion.x, 18, WORLD_WIDTH - 18)
    companion.y = Phaser.Math.Clamp(companion.y, 18, WORLD_HEIGHT - 18)
  }

  separateCompanions() {
    for (let i = 0; i < this.companions.length; i += 1) {
      for (let j = i + 1; j < this.companions.length; j += 1) {
        const first = this.companions[i]
        const second = this.companions[j]
        const dx = second.x - first.x
        const dy = second.y - first.y
        const distanceSq = dx * dx + dy * dy

        if (distanceSq >= COMPANION.separation * COMPANION.separation) {
          continue
        }

        const distance = Math.sqrt(distanceSq) || 1
        const overlap = (COMPANION.separation - distance) / 2
        const pushX = (dx / distance) * overlap
        const pushY = (dy / distance) * overlap

        first.x -= pushX
        first.y -= pushY
        second.x += pushX
        second.y += pushY

        first.x = Phaser.Math.Clamp(first.x, 18, WORLD_WIDTH - 18)
        first.y = Phaser.Math.Clamp(first.y, 18, WORLD_HEIGHT - 18)
        second.x = Phaser.Math.Clamp(second.x, 18, WORLD_WIDTH - 18)
        second.y = Phaser.Math.Clamp(second.y, 18, WORLD_HEIGHT - 18)
      }
    }
  }

  showCompanionHit(companion, enemy) {
    const direction = new Phaser.Math.Vector2(enemy.x - companion.x, enemy.y - companion.y).normalize()
    const hit = this.add.circle(
      companion.x + direction.x * 24,
      companion.y + direction.y * 24,
      17,
      0x4fc3ff,
      0,
    )
    hit.setStrokeStyle(3, 0x4fc3ff, 0.58)

    this.tweens.add({
      targets: hit,
      alpha: 0,
      scale: 1.3,
      duration: 120,
      onComplete: () => hit.destroy(),
    })
  }

  showMeleeHit(enemy) {
    const direction = new Phaser.Math.Vector2(
      enemy.x - this.player.x,
      enemy.y - this.player.y,
    ).normalize()
    const hitX = this.player.x + direction.x * 32
    const hitY = this.player.y + direction.y * 32
    const slash = this.add.circle(hitX, hitY, this.attackRange * 0.5, 0x111111, 0)
    slash.setStrokeStyle(3, 0x111111, 0.48)

    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.25,
      duration: 130,
      onComplete: () => slash.destroy(),
    })
  }

  collectMeat() {
    for (const meat of [...this.meatOnGround]) {
      const distance = Phaser.Math.Distance.Between(
        meat.x,
        meat.y,
        this.player.x,
        this.player.y,
      )

      if (distance < 92) {
        const direction = new Phaser.Math.Vector2(
          this.player.x - meat.x,
          this.player.y - meat.y,
        ).normalize()

        meat.x += direction.x * 7
        meat.y += direction.y * 7
      }

      if (distance <= this.player.radius + meat.radius + 4) {
        this.removeMeat(meat)
        this.addRawMeat(MEAT_VALUE)
      }
    }
  }

  damagePlayer(amount) {
    this.hp = Math.max(0, this.hp - amount)
    this.hpText.setText(`HP ${this.hp}`)
    this.updateHealthBar(this.player, this.hp, this.maxHp)
    this.cameras.main.shake(90, 0.006)

    if (this.hp <= 0) {
      this.showGameOver()
    }
  }

  addScore() {
    this.score += 1
    this.scoreText.setText(`KILL ${this.score}`)
  }

  addCoins(amount) {
    this.coins += amount
    this.updateInventoryText()
  }

  addRawMeat(amount) {
    this.rawMeat += amount
    this.updateInventoryText()
  }

  updateInventoryText() {
    this.coinText.setText(`COIN ${this.coins}`)
    this.refreshCarriedStacks()
    this.refreshCookStacks()
    this.refreshSellStacks()
    this.updateCompanionBeaconText()
    this.updateRangedBeaconText()
  }

  refreshCarriedStacks() {
    for (const item of this.carriedStackSprites) {
      item.destroy()
    }

    this.carriedStackSprites = [
      ...this.createCarriedStackItems('raw', this.rawMeat),
      ...this.createCarriedStackItems('cooked', this.cookedMeat),
    ]
    this.updateCarriedStacks()
  }

  createCarriedStackItems(type, count) {
    const items = []
    const visibleCount = Math.min(count, CARRY_STACK.visibleLimit)
    const isCooked = type === 'cooked'

    for (let index = 0; index < visibleCount; index += 1) {
      const item = this.add.ellipse(0, 0, 15, 9, isCooked ? 0xd6762e : 0xb8422c)
      item.setStrokeStyle(2, isCooked ? 0x7a3f18 : 0x7a241b)
      item.setDepth(4)
      item.stackType = type
      item.stackIndex = index
      items.push(item)
    }

    if (count > CARRY_STACK.visibleLimit) {
      const label = this.add.text(0, 0, `+${count - CARRY_STACK.visibleLimit}`, {
        fontSize: '12px',
        color: isCooked ? '#7a3f18' : '#7a241b',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      label.setDepth(6)
      label.stackType = type
      label.stackIndex = visibleCount
      items.push(label)
    }

    return items
  }

  updateCarriedStacks() {
    for (const item of this.carriedStackSprites) {
      const xOffset = item.stackType === 'cooked'
        ? CARRY_STACK.cookedXOffset
        : CARRY_STACK.rawXOffset
      const wobble = item.stackIndex % 2 === 0 ? -2 : 2

      item.setPosition(
        this.player.x + xOffset + wobble,
        this.player.y + CARRY_STACK.baseYOffset - item.stackIndex * CARRY_STACK.itemGap,
      )
    }
  }

  refreshCookStacks() {
    for (const item of this.cookStackSprites) {
      item.destroy()
    }

    this.cookStackSprites = [
      ...this.createCookStackItems('raw', this.cookingRawMeat),
      ...this.createCookStackItems('cooked', this.readyCookedMeat),
    ]
  }

  createCookStackItems(type, count) {
    const items = []
    const visibleCount = Math.min(count, COOK_STACK.visibleLimit)
    const isCooked = type === 'cooked'
    const xOffset = isCooked ? COOK_STACK.cookedXOffset : COOK_STACK.rawXOffset

    for (let index = 0; index < visibleCount; index += 1) {
      const item = this.add.ellipse(
        COOK_NPC.x + xOffset + (index % 2 === 0 ? -2 : 2),
        COOK_NPC.y + COOK_STACK.yOffset - index * COOK_STACK.itemGap,
        16,
        10,
        isCooked ? 0xd6762e : 0xb8422c,
      )
      item.setStrokeStyle(2, isCooked ? 0x7a3f18 : 0x7a241b)
      item.setDepth(6)
      items.push(item)
    }

    if (count > COOK_STACK.visibleLimit) {
      const label = this.add.text(
        COOK_NPC.x + xOffset,
        COOK_NPC.y + COOK_STACK.yOffset - visibleCount * COOK_STACK.itemGap,
        `+${count - COOK_STACK.visibleLimit}`,
        {
          fontSize: '12px',
          color: isCooked ? '#7a3f18' : '#7a241b',
          fontStyle: 'bold',
        },
      ).setOrigin(0.5)
      label.setDepth(7)
      items.push(label)
    }

    return items
  }

  refreshSellStacks() {
    for (const item of this.sellStackSprites) {
      item.destroy()
    }

    this.sellStackSprites = [
      ...this.createSellStackItems('cooked', this.sellingCookedMeat),
      ...this.createSellStackItems('coin', this.readyCoins),
    ]
  }

  createSellStackItems(type, count) {
    const items = []
    const visibleCount = Math.min(count, SELL_STACK.visibleLimit)
    const isCoin = type === 'coin'
    const xOffset = isCoin ? SELL_STACK.coinXOffset : SELL_STACK.cookedXOffset

    for (let index = 0; index < visibleCount; index += 1) {
      const item = isCoin
        ? this.add.circle(
          TRADER_NPC.x + xOffset + (index % 2 === 0 ? -2 : 2),
          TRADER_NPC.y + SELL_STACK.yOffset - index * SELL_STACK.itemGap,
          7,
          0xf3c431,
        )
        : this.add.ellipse(
          TRADER_NPC.x + xOffset + (index % 2 === 0 ? -2 : 2),
          TRADER_NPC.y + SELL_STACK.yOffset - index * SELL_STACK.itemGap,
          16,
          10,
          0xd6762e,
        )
      item.setStrokeStyle(2, isCoin ? 0xffffff : 0x7a3f18)
      item.setDepth(6)
      items.push(item)
    }

    if (count > SELL_STACK.visibleLimit) {
      const label = this.add.text(
        TRADER_NPC.x + xOffset,
        TRADER_NPC.y + SELL_STACK.yOffset - visibleCount * SELL_STACK.itemGap,
        `+${count - SELL_STACK.visibleLimit}`,
        {
          fontSize: '12px',
          color: isCoin ? '#7b5410' : '#7a3f18',
          fontStyle: 'bold',
        },
      ).setOrigin(0.5)
      label.setDepth(7)
      items.push(label)
    }

    return items
  }

  updateCooking(delta) {
    if (this.cookingRawMeat <= 0) {
      this.cookTimer = 0
      return
    }

    this.cookTimer -= delta

    if (this.cookTimer > 0) {
      return
    }

    this.cookingRawMeat -= 1
    this.readyCookedMeat += 1
    this.cookTimer = COOK_TIME
    this.updateInventoryText()
    this.showFloatingText(COOK_NPC.x, COOK_NPC.y - 52, '+COOKED')
  }

  updateCookedPickup(delta) {
    const pickupX = COOK_NPC.x + COOK_STACK.cookedXOffset
    const pickupY = COOK_NPC.y + COOK_STACK.yOffset
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      pickupX,
      pickupY,
    )

    if (distance > COOK_NPC.interactRange || this.readyCookedMeat <= 0) {
      this.cookPickupTimer = 0
      return
    }

    this.cookPickupTimer -= delta

    if (this.cookPickupTimer > 0) {
      return
    }

    this.readyCookedMeat -= 1
    this.cookedMeat += 1
    this.cookPickupTimer = COOK_PICKUP_TIME
    this.updateInventoryText()
  }

  updateSellDeposit(delta) {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      TRADER_NPC.x,
      TRADER_NPC.y,
    )

    if (distance > TRADER_NPC.interactRange || this.cookedMeat <= 0) {
      this.sellDepositTimer = 0
      return
    }

    this.sellDepositTimer -= delta

    if (this.sellDepositTimer > 0) {
      return
    }

    this.cookedMeat -= 1
    this.sellingCookedMeat += 1
    this.sellConvertTimer = Math.min(this.sellConvertTimer || SELL_CONVERT_TIME, SELL_CONVERT_TIME)
    this.sellDepositTimer = SELL_DEPOSIT_TIME
    this.updateInventoryText()
  }

  updateSellConversion(delta) {
    if (this.sellingCookedMeat <= 0) {
      this.sellConvertTimer = 0
      return
    }

    this.sellConvertTimer -= delta

    if (this.sellConvertTimer > 0) {
      return
    }

    this.sellingCookedMeat -= 1
    this.readyCoins += COINS_PER_COOKED_MEAT
    this.sellConvertTimer = SELL_CONVERT_TIME
    this.updateInventoryText()
    this.showFloatingText(TRADER_NPC.x, TRADER_NPC.y - 52, '+COIN')
  }

  updateSellCoinPickup(delta) {
    const coinX = TRADER_NPC.x + SELL_STACK.coinXOffset
    const coinY = TRADER_NPC.y + SELL_STACK.yOffset
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      coinX,
      coinY,
    )

    if (distance > TRADER_NPC.interactRange || this.readyCoins <= 0) {
      this.sellCoinPickupTimer = 0
      return
    }

    this.sellCoinPickupTimer -= delta

    if (this.sellCoinPickupTimer > 0) {
      return
    }

    this.readyCoins -= 1
    this.addCoins(1)
    this.sellCoinPickupTimer = SELL_COIN_PICKUP_TIME
  }

  updateCookDeposit(delta) {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      COOK_NPC.x,
      COOK_NPC.y,
    )

    if (distance > COOK_NPC.interactRange || this.rawMeat <= 0) {
      this.cookDepositTimer = 0
      return
    }

    this.cookDepositTimer -= delta

    if (this.cookDepositTimer > 0) {
      return
    }

    this.depositOneRawMeat()
    this.cookDepositTimer = COOK_DEPOSIT_TIME
  }

  depositOneRawMeat() {
    if (this.rawMeat <= 0) {
      return
    }

    this.rawMeat -= 1
    this.cookingRawMeat += 1
    this.cookTimer = Math.min(this.cookTimer || COOK_TIME, COOK_TIME)
    this.updateInventoryText()
  }

  killEnemy(enemy) {
    const meat = this.createMeatDrop(enemy.x, enemy.y)
    this.meatOnGround.push(meat)

    this.removeEnemy(enemy)
    this.addScore()
  }

  createMeatDrop(x, y) {
    const meat = this.add.container(x, y)
    const shadow = this.add.ellipse(0, 8, 18, 6, 0x111111, 0.16)
    const body = this.add.ellipse(0, 0, 18, 11, 0xb8422c)
    body.setStrokeStyle(2, 0x7a241b)
    const shine = this.add.circle(-4, -2, 3, 0xffc7b7, 0.9)
    const bone = this.add.rectangle(8, 1, 8, 4, 0xfff3df)
    bone.setStrokeStyle(1, 0xd7bfa0)

    meat.add([shadow, body, shine, bone])
    meat.radius = 10
    meat.setDepth(4)
    meat.setScale(0.45)

    this.tweens.add({
      targets: meat,
      x: x + Phaser.Math.Between(-12, 12),
      y: y + Phaser.Math.Between(-8, 8),
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
    })

    return meat
  }

  tryBuyCompanion() {
    if (this.gameOver || this.isUpgrading) {
      return
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      COMPANION_BEACON.x,
      COMPANION_BEACON.y,
    )

    if (distance > COMPANION_BEACON.interactRange) {
      return
    }

    if (this.companions.length >= COMPANION_BEACON.max) {
      this.showFloatingText(COMPANION_BEACON.x, COMPANION_BEACON.y - 54, 'ALLY FULL')
      return
    }

    if (this.coins < COMPANION_BEACON.cost) {
      this.showFloatingText(COMPANION_BEACON.x, COMPANION_BEACON.y - 54, 'NEED COIN')
      return
    }

    this.coins -= COMPANION_BEACON.cost
    this.updateInventoryText()
    this.createCompanion(
      this.player.x + Phaser.Math.Between(-34, 34),
      this.player.y + Phaser.Math.Between(24, 44),
    )
    this.updateCompanionBeaconText()
    this.showFloatingText(COMPANION_BEACON.x, COMPANION_BEACON.y - 54, '+ALLY')
  }

  tryActivateRangedAttack() {
    if (this.gameOver || this.isUpgrading) {
      return
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      RANGED_BEACON.x,
      RANGED_BEACON.y,
    )

    if (distance > RANGED_BEACON.interactRange) {
      return
    }

    if (this.hasRangedAttack) {
      this.showFloatingText(RANGED_BEACON.x, RANGED_BEACON.y - 54, 'RANGED ON')
      return
    }

    if (this.coins < RANGED_BEACON.cost) {
      this.showFloatingText(RANGED_BEACON.x, RANGED_BEACON.y - 54, 'NEED COIN')
      return
    }

    this.coins -= RANGED_BEACON.cost
    this.hasRangedAttack = true
    this.player.setTint(0xd9b3ff)
    this.updateInventoryText()
    this.showFloatingText(RANGED_BEACON.x, RANGED_BEACON.y - 54, 'RANGED ON')
  }

  createCompanion(x, y) {
    const companion = this.add.container(x, y)
    const shadow = this.add.ellipse(0, 11, 25, 8, 0x111111, 0.16)
    const body = this.add.image(0, 0, CHARACTER_ATLAS_KEY, this.characterFrames.soldier.defaultFrame)
    body.characterFrameMap = this.characterFrames.soldier
    body.setDisplaySize(38, 43)
    this.applyDirectionalSprite(body, new Phaser.Math.Vector2(0, 1), 1)
    const weapon = this.add.rectangle(15, -1, 18, 5, 0x2f5572)
    weapon.setStrokeStyle(1, 0xffffff, 0.8)

    companion.add([shadow, body, weapon])
    companion.body = body
    companion.setDepth(5)
    companion.attackCooldown = Phaser.Math.Between(0, COMPANION.attackRate)
    this.companions.push(companion)

    this.tweens.add({
      targets: companion,
      scale: { from: 0.35, to: 1 },
      duration: 180,
      ease: 'Back.Out',
    })
  }

  updateCompanionBeaconText() {
    if (!this.companionBeaconText) {
      return
    }

    this.companionBeaconText.setText([
      `ALLY ${this.companions.length}/${COMPANION_BEACON.max}`,
      `${COMPANION_BEACON.cost} COIN`,
    ])
  }

  updateRangedBeaconText() {
    if (!this.rangedBeaconText) {
      return
    }

    if (this.rangedBeacon) {
      this.rangedBeacon.setFillStyle(this.hasRangedAttack ? 0xf3c431 : 0x9b59b6, 0.95)
    }

    this.rangedBeaconText.setText([
      this.hasRangedAttack ? 'RANGED ON' : 'RANGED',
      this.hasRangedAttack ? 'ACTIVE' : `${RANGED_BEACON.cost} COIN`,
    ])
  }

  updateNpcPrompt() {
    const merchantDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      MERCHANT.x,
      MERCHANT.y,
    )
    const cookDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      COOK_NPC.x,
      COOK_NPC.y,
    )
    const cookedPickupDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      COOK_NPC.x + COOK_STACK.cookedXOffset,
      COOK_NPC.y + COOK_STACK.yOffset,
    )
    const traderDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      TRADER_NPC.x,
      TRADER_NPC.y,
    )
    const traderCoinDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      TRADER_NPC.x + SELL_STACK.coinXOffset,
      TRADER_NPC.y + SELL_STACK.yOffset,
    )
    const beaconDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      COMPANION_BEACON.x,
      COMPANION_BEACON.y,
    )
    const rangedBeaconDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      RANGED_BEACON.x,
      RANGED_BEACON.y,
    )

    if (cookDistance <= COOK_NPC.interactRange) {
      if (this.rawMeat > 0) {
        this.merchantPrompt.setText('DROPPING MEAT')
      } else if (this.readyCookedMeat > 0 && cookedPickupDistance <= COOK_NPC.interactRange) {
        this.merchantPrompt.setText('PICKING COOKED')
      } else {
        this.merchantPrompt.setText('NEED MEAT')
      }

      return
    }

    if (traderDistance <= TRADER_NPC.interactRange) {
      if (this.cookedMeat > 0) {
        this.merchantPrompt.setText('DROPPING COOKED')
      } else if (this.readyCoins > 0 && traderCoinDistance <= TRADER_NPC.interactRange) {
        this.merchantPrompt.setText('PICKING COIN')
      } else {
        this.merchantPrompt.setText('NEED COOKED')
      }

      return
    }

    if (beaconDistance <= COMPANION_BEACON.interactRange) {
      if (this.companions.length >= COMPANION_BEACON.max) {
        this.merchantPrompt.setText('ALLY FULL')
      } else if (this.coins >= COMPANION_BEACON.cost) {
        this.merchantPrompt.setText('BUY ALLY: TAP / E')
      } else {
        this.merchantPrompt.setText(`NEED ${COMPANION_BEACON.cost} COIN`)
      }

      if (
        Phaser.Input.Keyboard.JustDown(this.keys.interact)
        || Phaser.Input.Keyboard.JustDown(this.keys.space)
      ) {
        this.tryBuyCompanion()
      }

      return
    }

    if (rangedBeaconDistance <= RANGED_BEACON.interactRange) {
      if (this.hasRangedAttack) {
        this.merchantPrompt.setText('RANGED ON')
      } else if (this.coins >= RANGED_BEACON.cost) {
        this.merchantPrompt.setText('BUY RANGED: TAP / E')
      } else {
        this.merchantPrompt.setText(`NEED ${RANGED_BEACON.cost} COIN`)
      }

      if (
        Phaser.Input.Keyboard.JustDown(this.keys.interact)
        || Phaser.Input.Keyboard.JustDown(this.keys.space)
      ) {
        this.tryActivateRangedAttack()
      }

      return
    }

    if (merchantDistance > MERCHANT.interactRange) {
      this.merchantPrompt.setText('')
      return
    }

    if (this.coins <= 0) {
      this.merchantPrompt.setText('NEED COINS')
      return
    }

    this.merchantPrompt.setText('TAP NPC / PRESS E')

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.interact)
      || Phaser.Input.Keyboard.JustDown(this.keys.space)
    ) {
      this.showUpgradeShop()
    }
  }

  tryCookMeat() {
    if (this.gameOver || this.isUpgrading || this.rawMeat <= 0) {
      return
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      COOK_NPC.x,
      COOK_NPC.y,
    )

    if (distance > COOK_NPC.interactRange) {
      return
    }

    this.depositOneRawMeat()
    this.cookDepositTimer = COOK_DEPOSIT_TIME
  }

  trySellCookedMeat() {
    if (this.gameOver || this.isUpgrading || this.cookedMeat <= 0) {
      return
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      TRADER_NPC.x,
      TRADER_NPC.y,
    )

    if (distance > TRADER_NPC.interactRange) {
      return
    }

    this.cookedMeat -= 1
    this.sellingCookedMeat += 1
    this.sellConvertTimer = Math.min(this.sellConvertTimer || SELL_CONVERT_TIME, SELL_CONVERT_TIME)
    this.sellDepositTimer = SELL_DEPOSIT_TIME
    this.updateInventoryText()
  }

  showFloatingText(x, y, text) {
    const label = this.add.text(x, y, text, {
      fontSize: '15px',
      color: '#111111',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.tweens.add({
      targets: label,
      y: y - 24,
      alpha: 0,
      duration: 650,
      onComplete: () => label.destroy(),
    })
  }

  tryOpenUpgradeShop() {
    if (this.gameOver || this.isUpgrading) {
      return
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      MERCHANT.x,
      MERCHANT.y,
    )

    if (distance <= MERCHANT.interactRange && this.coins > 0) {
      this.showUpgradeShop()
    }
  }

  showUpgradeShop() {
    this.isUpgrading = true
    this.clearTouchInput()

    const overlay = this.add.container(this.cameras.main.scrollX, this.cameras.main.scrollY)
    overlay.setDepth(2000)

    overlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0.78))
    overlay.add(this.add.text(WIDTH / 2, 170, 'UPGRADE', {
      fontSize: '40px',
      color: '#111111',
      fontStyle: 'bold',
    }).setOrigin(0.5))
    overlay.add(this.add.text(WIDTH / 2, 215, `COIN ${this.coins}`, {
      fontSize: '20px',
      color: '#9b6a12',
      fontStyle: 'bold',
    }).setOrigin(0.5))

    const upgrades = [
      {
        key: 'blade',
        title: 'SHARP BLADE',
        desc: 'Melee damage +1',
        cost: 5 + this.upgradeCounts.blade * 5,
        apply: () => {
          this.attackDamage += 1
          this.upgradeCounts.blade += 1
        },
      },
      {
        key: 'speed',
        title: 'QUICK SWING',
        desc: 'Attack speed +16%',
        cost: 4 + this.upgradeCounts.speed * 4,
        apply: () => {
          this.attackRate = Math.max(280, Math.floor(this.attackRate * 0.84))
          this.upgradeCounts.speed += 1
        },
      },
      {
        key: 'reach',
        title: 'LONG HANDLE',
        desc: 'Melee range +10',
        cost: 3 + this.upgradeCounts.reach * 4,
        apply: () => {
          this.attackRange += 10
          this.upgradeCounts.reach += 1
        },
      },
      {
        title: 'LIGHT STEP',
        desc: 'Move speed +12%',
        cost: 4 + this.upgradeCounts.boots * 4,
        apply: () => {
          this.playerSpeed = Math.floor(this.playerSpeed * 1.12)
          this.upgradeCounts.boots += 1
        },
      },
      {
        title: 'RECOVER',
        desc: 'Heal 250 HP',
        cost: 3 + this.upgradeCounts.heal * 2,
        apply: () => {
          this.hp = Math.min(this.maxHp, this.hp + 250)
          this.hpText.setText(`HP ${this.hp}`)
          this.updateHealthBar(this.player, this.hp, this.maxHp)
          this.upgradeCounts.heal += 1
        },
      },
    ].filter((upgrade) => upgrade.title !== 'RECOVER' || this.hp < this.maxHp)

    const choices = Phaser.Utils.Array.Shuffle(upgrades).slice(0, 3)

    choices.forEach((upgrade, index) => {
      const y = 285 + index * 112
      const card = this.add.rectangle(WIDTH / 2, y, WIDTH - 90, 78, 0xffffff, 1)
      const canAfford = this.coins >= upgrade.cost
      card.setStrokeStyle(3, canAfford ? 0x111111 : 0x9a9a9a)
      card.setInteractive({ useHandCursor: true })

      const title = this.add.text(95, y - 22, upgrade.title, {
        fontSize: '20px',
        color: canAfford ? '#111111' : '#777777',
        fontStyle: 'bold',
      })

      const desc = this.add.text(95, y + 8, `${upgrade.desc}  /  ${upgrade.cost} coin`, {
        fontSize: '15px',
        color: canAfford ? '#555555' : '#888888',
      })

      const choose = () => {
        if (this.coins < upgrade.cost) {
          this.cameras.main.shake(80, 0.003)
          return
        }

        this.coins -= upgrade.cost
        this.updateInventoryText()
        upgrade.apply()
        overlay.destroy()
        this.isUpgrading = false
      }

      card.on('pointerdown', choose)
      title.setInteractive({ useHandCursor: true }).on('pointerdown', choose)
      desc.setInteractive({ useHandCursor: true }).on('pointerdown', choose)

      overlay.add([card, title, desc])
    })

    const closeButton = this.add.rectangle(WIDTH / 2, 650, 150, 42, 0x111111)
    closeButton.setInteractive({ useHandCursor: true })
    const closeText = this.add.text(WIDTH / 2, 650, 'CLOSE', {
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    const close = () => {
      overlay.destroy()
      this.isUpgrading = false
    }

    closeButton.on('pointerdown', close)
    closeText.setInteractive({ useHandCursor: true }).on('pointerdown', close)
    overlay.add([closeButton, closeText])
  }

  updateTimer() {
    const totalSeconds = Math.floor(this.elapsed)
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    this.timeText.setText(`${minutes}:${seconds}`)
  }

  removeEnemy(enemy) {
    Phaser.Utils.Array.Remove(this.enemies, enemy)

    if (enemy.slot) {
      enemy.slot.enemy = null
      enemy.slot.respawnTimer = CAMP_RESPAWN_TIME
    }

    this.destroyHealthBar(enemy)
    this.destroyCharacterShadow(enemy)
    enemy.destroy()
  }

  createHealthBar(target, maxHp) {
    const background = this.add.rectangle(
      target.x,
      target.y + HEALTH_BAR.yOffset,
      HEALTH_BAR.width,
      HEALTH_BAR.height,
      0x2b2b2b,
      0.82,
    )
    const fill = this.add.rectangle(
      target.x - HEALTH_BAR.width / 2,
      target.y + HEALTH_BAR.yOffset,
      HEALTH_BAR.width,
      HEALTH_BAR.height,
      0x35c75a,
      1,
    )
    fill.setOrigin(0, 0.5)

    const healthBar = { background, fill, maxHp }
    target.healthBar = healthBar
    this.updateHealthBar(target, maxHp, maxHp)
    return healthBar
  }

  updateHealthBar(target, hp, maxHp) {
    if (!target.healthBar) {
      return
    }

    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1)
    const { background, fill } = target.healthBar
    background.setPosition(target.x, target.y + HEALTH_BAR.yOffset)
    fill.setPosition(target.x - HEALTH_BAR.width / 2, target.y + HEALTH_BAR.yOffset)
    fill.displayWidth = HEALTH_BAR.width * ratio
    fill.setFillStyle(ratio > 0.5 ? 0x35c75a : ratio > 0.25 ? 0xf0b429 : 0xe33b3b)
  }

  destroyHealthBar(target) {
    if (!target.healthBar) {
      return
    }

    target.healthBar.background.destroy()
    target.healthBar.fill.destroy()
    target.healthBar = null
  }

  removeMeat(meat) {
    Phaser.Utils.Array.Remove(this.meatOnGround, meat)
    meat.destroy()
  }

  showGameOver() {
    this.gameOver = true

    for (const enemy of this.enemies) {
      this.destroyHealthBar(enemy)
      this.destroyCharacterShadow(enemy)
      enemy.destroy()
    }

    for (const meat of this.meatOnGround) {
      meat.destroy()
    }

    for (const item of this.cookStackSprites) {
      item.destroy()
    }

    for (const item of this.sellStackSprites) {
      item.destroy()
    }

    for (const companion of this.companions) {
      companion.destroy()
    }

    this.enemies = []
    this.companions = []
    this.meatOnGround = []
    this.cookStackSprites = []
    this.sellStackSprites = []

    const panel = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 70, 190, 0xffffff, 0.94)
      .setStrokeStyle(3, 0x111111)
    panel.setScrollFactor(0)
    panel.setDepth(2000)

    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 40, 'GAME OVER', {
      fontSize: '46px',
      color: '#111111',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    title.setScrollFactor(0)
    title.setDepth(2001)

    const score = this.add.text(WIDTH / 2, HEIGHT / 2 + 20, `KILL ${this.score}`, {
      fontSize: '24px',
      color: '#e33b3b',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    score.setScrollFactor(0)
    score.setDepth(2001)

    const restartButton = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 70, 170, 42, 0x111111)
    restartButton.setInteractive({ useHandCursor: true })
    restartButton.setScrollFactor(0)
    restartButton.setDepth(2001)

    const restartText = this.add.text(WIDTH / 2, HEIGHT / 2 + 70, 'RESTART', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    restartText.setScrollFactor(0)
    restartText.setDepth(2002)

    restartButton.on('pointerdown', () => {
      this.scene.restart()
    })
  }
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: GameScene,
}

new Phaser.Game(config)
