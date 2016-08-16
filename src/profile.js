'use strict'

const addNicknameButton = document.getElementById('addNicknameButton')

const addNicknameDialogTemplate = document.getElementById('addNicknameDialogTemplate')
const addNicknameCheckTemplate = document.getElementById('addNicknameCheckTemplate')
const addNicknameAuthTemplate = document.getElementById('addNicknameAuthTemplate')
const registerNicknameAuthTemplate = document.getElementById('registerNicknameAuthTemplate')
const removeNicknameDialogTemplate = document.getElementById('removeNicknameDialogTemplate')

class Profile {
  constructor () {
    addNicknameButton.addEventListener('click', this.showAddNicknameDialog.bind(this), false)

    let rescues = document.querySelectorAll('[data-rescue]')
    for (let rescue = 0; rescue < rescues.length; rescue += 1) {
      rescues[rescue].addEventListener('click', this.navigateToRescue, false)
    }

    let deleteButtons = document.querySelectorAll('.rat-list .delete')
    for (let deleteButton = 0; deleteButton < deleteButtons.length; deleteButton += 1) {
      deleteButtons[deleteButton].addEventListener('click', this.showRemoveNicknameDialog.bind(this), false)
    }
  }

  showAddNicknameDialog () {
    new NicknameDialog()
  }

  showRemoveNicknameDialog (event) {
    new RemoveNicknameDialog(event.currentTarget.getAttribute('data-nickname'))
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
    request.open('GET', '/nicknames/' + nicknameField.value, true)
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

    request.onerror = () => {

    }

    request.send()
  }
}

function clearContentsOfNode (node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

new Profile()
