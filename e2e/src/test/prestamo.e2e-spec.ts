import { browser } from 'protractor';
import { PrestamoPage } from './../page/prestamo/prestamo.po';

const ISBN = 'A354874R';
const NOMBRE_PRESTADOR = 'Felipe Alzate';

describe('workspace-project Prestamo', () => {
  let prestamo: PrestamoPage;

  beforeEach(() => {
    prestamo = new PrestamoPage();
  });

  afterEach(async (done) => {
    await browser.executeScript('window.localStorage.clear();');
    done();
});

  it('Debería mostrar mensaje ISBN obligatorio', async () => {

    expect(browser.getCurrentUrl()).toMatch('home');

    await prestamo.setIsbn('');
    await prestamo.setNombre(NOMBRE_PRESTADOR);
    prestamo.clickBotonPrestar().then(() => {
      const mensaje = prestamo.getMensajeErrorRequired();
      expect(mensaje).toEqual('ISBN es obligatorio');
    });
  });

  it('Muestra mensaje error Nombre obligatorio', () => {
    expect(browser.getCurrentUrl()).toMatch('home');

    prestamo.setIsbn(ISBN);
    prestamo.setNombre('');
    prestamo.clickBotonPrestar().then(() => {
      const mensaje = prestamo.getMensajeErrorRequired();
      expect(mensaje).toEqual('Nombre es obligatorio');
    });
  });
});
