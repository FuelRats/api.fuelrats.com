export default class RegexLiteral {
  /**
   * Creates a Regular expression object from a string literal, spaces and newlines are automatically
   * stripped allowing the expression to be formed in a readable manner, Thanks Trezy.
   * @param literal A string literal containing the regular expression
   * @param flags Regular expression flags, defaults to "gu"
   * @returns {RegExp} A regular expression object created from the string literal
   */
  constructor (literal, flags = 'gu') {
    return new RegExp(literal.replace(/[\n\s]+/gu, 'gu'), flags)
  }
}
