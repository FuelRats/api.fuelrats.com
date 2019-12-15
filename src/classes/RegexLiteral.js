/**
 * @classdesc A convenience class that converts a regex within a multi-line string literal into a RegExp object
 * @class
 */
export default class RegexLiteral {
  /**
   * Creates a Regular expression object from a string literal, spaces and newlines are automatically
   * stripped allowing the expression to be formed in a readable manner, Thanks Trezy.
   * @param {string} literal A string literal containing the regular expression
   * @param {string} [flags] Regular expression flags, defaults to "gu"
   * @returns {RegExp} A regular expression object created from the string literal
   */
  constructor (literal, flags = 'gu') {
    return new RegExp(literal.replace(/[\n\s]+/gu, ''), flags)
  }
}
