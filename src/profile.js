'use strict'

const addNicknameButton = document.getElementById('addNicknameButton')
const addShipButton = document.getElementById('addShipButton')

const addNicknameDialogTemplate = document.getElementById('addNicknameDialogTemplate')
const addNicknameCheckTemplate = document.getElementById('addNicknameCheckTemplate')
const addNicknameAuthTemplate = document.getElementById('addNicknameAuthTemplate')
const registerNicknameAuthTemplate = document.getElementById('registerNicknameAuthTemplate')
const removeNicknameDialogTemplate = document.getElementById('removeNicknameDialogTemplate')
const addShipDialogTemplate = document.getElementById('addShipDialogTemplate')
const removeShipDialogTemplate = document.getElementById('removeShipDialogTemplate')

const shipTypes = [
  'Adder',
  'Anaconda',
  'Asp Explorer',
  'Asp Scout',
  'Beluga Liner',
  'Cobra MkIII',
  'Cobra MkIV',
  'Diamondback Explorer',
  'Diamondback Scout',
  'Dolphin',
  'Eagle',
  'F63 Condor',
  'Federal Assault Ship',
  'Federal Corvette',
  'Federal Dropship',
  'Federal Gunship',
  'Fer-de-lance',
  'Hauler',
  'Imperial Clipper',
  'Imperial Courier',
  'Imperial Cutter',
  'Imperial Eagle',
  'Imperial Fighter',
  'Keelback',
  'Orca',
  'Python',
  'Sidewinder MkI',
  'Taipan Fighter',
  'Type-6 Transporter',
  'Type-7 Transporter',
  'Type 9 Heavy',
  'Viper MkIII',
  'Viper MkIV',
  'Vulture'
]

class Profile {
  constructor () {
    addNicknameButton.addEventListener('click', this.showAddNicknameDialog.bind(this), false)
    addShipButton.addEventListener('click', this.showAddShipDialog.bind(this), false)

    let rescues = document.querySelectorAll('[data-rescue]')
    for (let rescue = 0; rescue < rescues.length; rescue += 1) {
      rescues[rescue].addEventListener('click', this.navigateToRescue, false)
    }

    let ratDeleteButtons = document.querySelectorAll('.rat-list .delete')
    for (let ratDeleteButton = 0; ratDeleteButton < ratDeleteButtons.length; ratDeleteButton += 1) {
      ratDeleteButtons[ratDeleteButton].addEventListener('click', this.showRemoveNicknameDialog.bind(this), false)
    }

    let shipDeleteButtons = document.querySelectorAll('.ship-list .delete')
    for (let shipDeleteButton = 0; shipDeleteButton < shipDeleteButtons.length; shipDeleteButton += 1) {
      shipDeleteButtons[shipDeleteButton].addEventListener('click', this.showRemoveShipDialog.bind(this), false)
    }
  }

  showAddNicknameDialog () {
    new NicknameDialog()
  }

  showRemoveNicknameDialog (event) {
    new RemoveNicknameDialog(event.currentTarget.getAttribute('data-nickname'))
  }

  showAddShipDialog () {
    new ShipDialog()
  }

  showRemoveShipDialog (event) {
    new RemoveShipDialog(event.currentTarget.getAttribute('data-ship'))
  }

  navigateToRescue (event) {
    window.location = 'https://api.fuelrats.com/rescues/view/' + event.currentTarget.getAttribute('data-rescue')
  }
}

class NicknameDialog {
  constructor () {
    let dialog = addNicknameDialogTemplate.content.cloneNode(true)
    document.body.appendChild(dialog)
    this.dialog = document.getElementById('addNicknameDialog')
    this.dialogFooter = this.dialog.querySelector('.modal-footer')

    this.addButton = this.dialog.querySelector('#modalAddNicknameButton')
    this.addButton.addEventListener('click', this.addNicknameButtonClicked.bind(this), false)

    let initialPage = addNicknameCheckTemplate.content.cloneNode(true)
    this.setContents(initialPage)

    jQuery('#addNicknameDialog').modal('show')

    jQuery('#addNicknameDialog').on('hidden', function () {
      document.body.removeChild(dialog)
    })
  }

  addNicknameButtonClicked () {
    let nicknameField = this.dialog.querySelector('#modalAddNicknameField')

    let request = new XMLHttpRequest()
    request.open('GET', '/nicknames/' + encodeURIComponent(nicknameField.value), true)
    request.onload = () => {
      try {
        this.nickname = nicknameField.value
        let response = JSON.parse(request.responseText)

        if (response.data && response.data !== {}) {
          let authPage = addNicknameAuthTemplate.content.cloneNode(true)

          this.setContents(authPage)
          this.dialogFooter.removeChild(this.addButton)

          let authButton = document.createElement('button')
          authButton.setAttribute('type', 'button')
          authButton.className = 'btn btn-primary'
          authButton.id = 'connectNicknameAuthButton'
          authButton.textContent = 'Authenticate'
          this.dialogFooter.appendChild(authButton)

          authButton.addEventListener('click', this.authNicknameButtonClicked.bind(this), false)
        } else {
          let registerPage = registerNicknameAuthTemplate.content.cloneNode(true)

          this.setContents(registerPage)
          this.dialogFooter.removeChild(this.addButton)

          let registerButton = document.createElement('button')
          registerButton.setAttribute('type', 'button')
          registerButton.className = 'btn btn-primary'
          registerButton.id = 'registerNicknameAuthButton'
          registerButton.textContent = 'Register'
          this.dialogFooter.appendChild(registerButton)

          registerButton.addEventListener('click', this.registerNicknameButtonClicked.bind(this), false)
        }
      } catch (err) {

      }
    }

    request.onerror = (error) => {
      console.log(error)
    }

    request.send()
  }

  authNicknameButtonClicked () {
    let passwordField = this.dialog.querySelector('#connectNicknamePasswordField')

    let request = new XMLHttpRequest()
    request.open('PUT', '/nicknames/', true)
    request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
    request.onload = () => {
      document.location.reload()
    }

    request.onerror = () => {

    }

    request.send(JSON.stringify({
      nickname: this.nickname,
      password: passwordField.value
    }))
  }

  registerNicknameButtonClicked () {
    let passwordField = this.dialog.querySelector('#registerNicknamePasswordField')

    let request = new XMLHttpRequest()
    request.open('POST', '/nicknames/', true)
    request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
    request.onload = () => {
      document.location.reload()
    }

    request.onerror = () => {

    }

    request.send(JSON.stringify({
      nickname: this.nickname,
      password: passwordField.value
    }))
  }

  setContents (contents) {
    let dialogBody = this.dialog.querySelector('.modal-body')
    clearContentsOfNode(dialogBody)
    dialogBody.appendChild(contents)
  }
}

class RemoveNicknameDialog {
  constructor (nickname) {
    let dialog = removeNicknameDialogTemplate.content.cloneNode(true)
    document.body.appendChild(dialog)
    this.dialog = document.getElementById('removeNicknameDialog')

    this.removeButton = this.dialog.querySelector('#modalRemoveNicknameButton')
    this.removeButton.addEventListener('click', this.removeNicknameButtonClicked.bind(this), false)
    this.nickname = nickname

    jQuery('#removeNicknameDialog').modal('show')


    jQuery('#removeNicknameDialog').on('hidden', function () {
      document.body.removeChild(dialog)
    })
  }

  removeNicknameButtonClicked () {
    let request = new XMLHttpRequest()
    request.open('DELETE', '/nicknames/' + this.nickname, true)
    request.onload = () => {
      document.location.reload()
    }

    request.send()
  }
}


class ShipDialog {
  constructor () {
    let dialog = addShipDialogTemplate.content.cloneNode(true)
    document.body.appendChild(dialog)
    this.dialog = document.getElementById('addShipDialog')

    this.addButton = this.dialog.querySelector('#addShipButton')
    this.addButton.addEventListener('click', this.addShipButtonClicked.bind(this), false)
    let shipTypeField = this.dialog.querySelector('#shipTypeField')
    for (let shipType of shipTypes) {
      let option = document.createElement('option')
      option.value = shipType
      option.textContent = shipType
      shipTypeField.appendChild(option)
    }
    shipTypeField.selectedIndex = 0

    let shipRatGroup = this.dialog.querySelector('#shipRatGroup')
    let request = new XMLHttpRequest()
    request.open('GET', '/profile', true)
    request.onload = () => {
      let response = JSON.parse(request.responseText)
      for (let rat of response.data.rats) {
        let ratRadioButton = document.createElement('input')
        ratRadioButton.type = 'radio'
        ratRadioButton.value = rat.id
        shipRatGroup.appendChild(ratRadioButton)


        let ratRadioButtonLabel = document.createElement('label')
        ratRadioButtonLabel.textContent = ' ' + rat.CMDRname
        shipRatGroup.appendChild(ratRadioButtonLabel)
        // <span class="label label-pill label-default">{{ CMDR.platform|formatPlatform() }}</span>

        let platformLabel = document.createElement('span')
        platformLabel.classList = 'label label-pill label-default'
        platformLabel.textContent = formatPlatform(rat.platform)
        shipRatGroup.appendChild(platformLabel)

        shipRatGroup.appendChild(document.createElement('br'))

        if (response.data.rats.indexOf(rat) === 0) {
          ratRadioButton.checked = true
        }
      }
    }

    request.send()

    jQuery('#addShipDialog').modal('show')

    jQuery('#addShipDialog').on('hidden', function () {
      document.body.removeChild(dialog)
    })
  }

  addShipButtonClicked () {
    let shipNameField = this.dialog.querySelector('#shipNameField')
    let shipTypeField = this.dialog.querySelector('#shipTypeField')

    let request = new XMLHttpRequest()
    request.open('POST', '/ships/', true)
    request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
    request.onload = () => {
      document.location.reload()
    }

    let shipRatValue = ''
    let ratRadioButtons = document.querySelectorAll('#shipRatGroup input[type="radio"]')
    for (let ratRadioButton of ratRadioButtons) {
      if (ratRadioButton.checked) {
        shipRatValue = ratRadioButton.value
      }
    }

    request.send(JSON.stringify({
      ratId: shipRatValue,
      name: shipNameField.value,
      type: shipTypeField.options[shipTypeField.selectedIndex].value
    }))
  }
}

class RemoveShipDialog {
  constructor (ship) {
    let dialog = removeShipDialogTemplate.content.cloneNode(true)
    document.body.appendChild(dialog)
    this.dialog = document.getElementById('removeShipDialog')

    this.removeButton = this.dialog.querySelector('#modalRemoveShipButton')
    this.removeButton.addEventListener('click', this.removeShipButtonClicked.bind(this), false)
    this.ship = ship

    jQuery('#removeShipDialog').modal('show')


    jQuery('#removeShipDialog').on('hidden', function () {
      document.body.removeChild(dialog)
    })
  }

  removeShipButtonClicked () {
    let request = new XMLHttpRequest()
    request.open('DELETE', '/ships/' + this.ship, true)
    request.onload = () => {
      document.location.reload()
    }

    request.send()
  }
}

let platforms = {
  ps: 'PS4',
  xb: 'XB1',
  pc: 'PC'
}

function formatPlatform (platform) {
  return platforms[platform]
}

function clearContentsOfNode (node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

new Profile()
