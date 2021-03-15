import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { HTTP_ERRORES_CODIGO, HTTP_SUCCESS_COD } from './http-codigo-error';
import { environment } from 'src/environments/environment';

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
      if (error.hasOwnProperty('status') && error.error.hasOwnProperty('mensaje')) {
        const mensajeError = this.obtenerErrorHttpCode(error.status);
        let mensaje = '';
        switch (mensajeError) {
          case HTTP_ERRORES_CODIGO['400']:
            mensaje = error.error.mensaje;
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
    const respuesta = {
      fecha: new Date().toLocaleString(),
      path: window.location.href,
      mensaje,
    };
    if (!environment.production) {
      window.console.error('Error inesperado:\n', respuesta);
    }
  }

  public obtenerErrorHttpCode(httpCode: number): string {
    if (HTTP_ERRORES_CODIGO.hasOwnProperty(httpCode)) {
      return HTTP_ERRORES_CODIGO[httpCode.toString()];
    }
    return HTTP_SUCCESS_COD[httpCode.toString()];
  }
}
