import { Router } from '@angular/router';
import { UserSessionService } from './../../shared/services/user-session.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent implements OnInit {

  isSubmitting = false;
  isInvalid = false;
  submitted = false;

  authForm: FormGroup;
  constructor(
    private userSessionService: UserSessionService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.construirFormularioLogin();
  }

  get f() { return this.authForm.controls; }

  login() {
    this.submitted = true;

    if (this.authForm.invalid) {
      return;
    }

    const login = this.authForm.value;

    this.userSessionService.login(login).subscribe(
      data => {
        this.submitted = false;
        console.log(data);
        this.router.navigateByUrl('home');
      }
    );
  }

  private construirFormularioLogin() {
    this.authForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required])
    });
  }

}
