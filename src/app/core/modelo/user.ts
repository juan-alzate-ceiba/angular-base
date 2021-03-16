export class User {
  public email: string;
  public password: string;
  public userName: string;

  constructor(email: string, password: string, userName: string) {
    this.email = email;
    this.password = password;
    this.userName = userName;
  }
}
