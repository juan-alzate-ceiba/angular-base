import { element, by } from 'protractor';

export class LoginPage {
  private email = element(by.id('email'));
  private password = element(by.id('password'));
  private btnLogin = element(by.id('btnLogin'));
  private lblEmailRequerido = element(by.id('emailRequerido'));
  private lblEmailNoValido = element(by.id('emailNoValido'));
  private lblPasswordRequerido = element(by.id('passRequerido'));

  async setEmail(email: string) {
    await this.email.sendKeys(email);
  }

  async setPassword(password: string) {
    await this.password.sendKeys(password);
  }

  async clickBtnLogin() {
    await this.btnLogin.click();
  }

  async getEmailRequerido() {
    return await this.lblEmailRequerido.getText();
  }

  getEmailValido() {
    return this.lblEmailNoValido.getText();
  }

  async getPasswordRequerido() {
    return await this.lblPasswordRequerido.getText();
  }

}
