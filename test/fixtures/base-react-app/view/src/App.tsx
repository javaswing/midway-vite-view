import { Route, Switch } from 'react-router-dom';

export function App() {
  return (
    <Switch>
      <Route path="/about">
        <About />
      </Route>

      <Route path="/">
        <Home />
      </Route>
    </Switch>
  );
}
