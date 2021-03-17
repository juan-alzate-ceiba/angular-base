import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { HTTP_ERRORES_CODIGO, HTTP_SUCCESS_COD } from './http-codigo-error';

@Injectable()
export class ManejadorError implements ErrorHandler {
  mensajeToastService;
  constructor(private injector: Injector) {}

  handleError(error: string | Error): void {
    this.mensajeToastService = this.injector.get(ToastrService);
    const mensajeMostrar = this.mensajePorDefecto(error);
    this.mostrarMensaje(mensajeMostrar);
  }

  private mensajePorDefecto(error) {
    if (error instanceof HttpErrorResponse) {
      if (!navigator.onLine) {
        return HTTP_ERRORES_CODIGO.NO_HAY_INTERNET;
      }
      if (error.hasOwnProperty('status') && (error.error.hasOwnProperty('mensaje') || error.hasOwnProperty('error'))) {
        const mensajeError = this.obtenerErrorHttpCode(error.status);
        let mensaje = '';
        switch (mensajeError) {
          case HTTP_ERRORES_CODIGO['400']:
            mensaje = error.error.mensaje ? error.error.mensaje : 'Usuario o contraseña incorrectas';
            break;
          case HTTP_SUCCESS_COD['200']:
            mensaje = mensajeError;
            break;
        }
        return mensaje;
      }
    }
    return error;
  }

  private mostrarMensaje(mensaje): void {
    this.mensajeToastService.error(mensaje);

  }

  public obtenerErrorHttpCode(httpCode: number): string {
    if (HTTP_ERRORES_CODIGO.hasOwnProperty(httpCode)) {
      return HTTP_ERRORES_CODIGO[httpCode.toString()];
    }
    return HTTP_SUCCESS_COD[httpCode.toString()];
  }
}
