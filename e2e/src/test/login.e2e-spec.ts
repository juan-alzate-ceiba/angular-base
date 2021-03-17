// import { browser } from 'protractor';
import { browser } from 'protractor';
import { AppPage } from './../app.po';
import { LoginPage } from './../page/login/login.po';
describe('work-space project login', () => {
  let login: LoginPage;
  let page: AppPage;

  beforeEach(() => {
    login = new LoginPage();
    page = new AppPage();
  });

  it('debería mostrar mensaje error email obligatorio', () => {
    page.navigateTo();
    login.setPassword('12345');
    login.clickBtnLogin();

    const emailReq = login.getEmailRequerido();

    expect(emailReq).toBeTruthy();
    expect(emailReq).toEqual('El email es obligatorio');

  });

  it('debería mostrar mensaje error email no valido', () => {
    page.navigateTo();
    login.setEmail('eve.holt@');
    login.setPassword('12345');
    login.clickBtnLogin();

    const emailInvalido = login.getEmailValido();

    expect(emailInvalido).toBeTruthy();
    expect(emailInvalido).toEqual('Ingrese un email válido');

  });

  it('muestra mensaje error password obligatorio', () => {
    page.navigateTo();
    login.setEmail('eve.holt@reqres.in');
    login.clickBtnLogin();

    const passReq = login.getPasswordRequerido();

    expect(passReq).toBeTruthy();
    expect(passReq).toEqual('El password es obligatorio');
  });

  it('redirecciona a la página de home si login es valido', () => {
    page.navigateTo();
    login.setEmail('eve.holt@reqres.in');
    login.setPassword('cityslicka');
    login.clickBtnLogin();

    expect(browser.getCurrentUrl()).toMatch('home');
  });
});
