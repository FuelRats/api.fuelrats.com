'use strict'

const addNicknameButton = document.getElementById('addNicknameButton')
const editNicknameButton = document.getElementById('editNicknameButton')
const removeNicknameButton = document.getElementById('removeNicknameButton')

class Profile {
  constructor () {
    addNicknameButton.addEventListener('click', this.showAddNicknameDialog, false)
    editNicknameButton.addEventListener('click', this.toggleEditNicknameMode, false)
    removeNicknameButton.addEventListener('click', this.toggleRemoveNicknameMode, false)
  }

  showAddNicknameDialog () {

  }

  toggleEditNicknameMode () {

  }

  toggleRemoveNicknameMode () {

  }
}

new Profile()
